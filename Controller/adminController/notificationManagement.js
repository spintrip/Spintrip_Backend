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
const sendNotification = async ({ receiverIds, receiverType, text, title = "Notification", metadata }) => {
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
        attributes: ["id", "deviceToken"],
      });
    } else {
      receivers = await receiverModel.findAll({
        where: { id: receiverIds },
        attributes: ["id", "deviceToken"], // Include only necessary fields
      });
    }

    if (!receivers || !receivers.length) {
      throw new Error("No receivers found");
    }

    // Send notifications
    const pushTokens = [];
    const notifications = await Promise.all(
      receivers.map(async (receiver) => {
        const notification = await Notification.create({
          receiverId: receiver.id,
          receiverType,
          text,
          metadata: metadata || {},
          status: "pending", // Set initial status
        });

        if (receiver.deviceToken) {
          pushTokens.push(receiver.deviceToken);
        }

        return notification;
      })
    );

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

module.exports = {
  sendNotification,
};
