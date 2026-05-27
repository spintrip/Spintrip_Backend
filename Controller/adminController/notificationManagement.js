const { Notification, User, Driver } = require("../../Models");
const { sendPushNotification, sendPushNotificationToMultipleDevices } = require("../pushNotificationService");

/**
 * Send notifications to users or drivers (push + in-app).
 * @param {Object} params - Notification details.
 * @param {string[]} params.receiverIds - Array of receiver IDs.
 * @param {string} params.receiverType - 'user' or 'driver'.
 * @param {string} params.text - The notification text.
 * @param {string} [params.title] - The notification title (for push notifications).
 * @param {string} [params.subject] - Email subject (optional).
 * @param {object} [params.metadata] - Additional data for the notification.
 */
const sendNotificationInternal = async ({ receiverIds, receiverType, text, title = "Notification", metadata }) => {
  try {
    if (!receiverIds || !receiverIds.length || !receiverType || !text) {
      throw new Error("Missing required fields");
    }

    if (!["user", "driver"].includes(receiverType)) {
      throw new Error("Invalid receiver type");
    }

    // Fetch receivers (users or drivers)
    const receiverModel = receiverType === "user" ? User : Driver;
    
    let receivers;
    if (receiverIds.length === 1 && receiverIds[0] === 'all') {
      receivers = await receiverModel.findAll({
        attributes: ["id", "fcmToken"],
      });
    } else {
      receivers = await receiverModel.findAll({
        where: { id: receiverIds },
        attributes: ["id", "fcmToken"], // Include only necessary fields
      });
    }

    if (!receivers || !receivers.length) {
      throw new Error("No receivers found");
    }

    // Send notifications
    // Collect push tokens
    const pushTokens = [];
    receivers.forEach((receiver) => {
      if (receiver.fcmToken) {
        pushTokens.push(receiver.fcmToken);
      }
    });

    const notifications = []; // Placeholder to avoid returning undefined

    // Send push notifications
    if (pushTokens.length) {
      try {
        const pushResponse = await sendPushNotificationToMultipleDevices(pushTokens, title, text, metadata);
        console.log("Push notifications sent:", pushResponse);
      } catch (pushError) {
        console.error("Error sending push notifications:", pushError.message);
      }
    }

    return notifications;
  } catch (error) {
    console.error("Error sending notifications:", error.message);
    throw error;
  }
};

const sendNotification = async (req, res) => {
  try {
    const { receiverIds, receiverType, text, title, imageUrl } = req.body;
    const metadata = imageUrl ? { image_url: imageUrl } : {};
    
    const result = await sendNotificationInternal({ receiverIds, receiverType, text, title, metadata });
    return res.status(200).json({ success: true, message: "Broadcast sent successfully", data: result });
  } catch (error) {
    console.error("Broadcast Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  sendNotification,
  sendNotificationInternal
};
