const { Notification, User, Driver } = require("../../Models");
const { sendEmail } = require("../emailController");
// Placeholder for FCM
const { sendPushNotification } = require("../pushNotificationService");

/**
 * Send notification to users or drivers.
 */
const sendNotification = async ({ receiverIds, receiverType, text, subject, metadata }) => {
  try {
    if (!receiverIds || receiverIds.length === 0 || !receiverType || !text) {
      throw new Error("Missing required fields");
    }

    if (!["user", "driver"].includes(receiverType)) {
      throw new Error("Invalid receiver type");
    }

    // Fetch receiver details
    const receiverModel = receiverType === "user" ? User : Driver;
    const receivers = await receiverModel.findAll({
      where: { id: receiverIds },
    });

    if (!receivers || receivers.length === 0) {
      throw new Error("No receivers found");
    }

    // Create and send notifications
    const notifications = await Promise.all(
      receivers.map(async (receiver) => {
        const notification = await Notification.create({
          receiverId: receiver.id,
          receiverType,
          text,
          deviceToken: receiver.deviceToken || null,
          metadata: metadata || {},
        });

        // Send email if subject provided (optional)
        if (subject && receiver.Email) {
          await sendEmail(receiver.Email, subject, text);
        }

        // Send push notification if device token available
        if (receiver.deviceToken) {
          await sendPushNotification(receiver.deviceToken, text, metadata);
        }

        return notification;
      })
    );

    return notifications;
  } catch (error) {
    console.error("Error sending notifications:", error.message);
    throw error;
  }
};

/**
 * Fetch notifications for a specific user or driver.
 */
const getNotifications = async ({ receiverId, receiverType, status }) => {
  try {
    if (!receiverId || !receiverType) {
      throw new Error("Missing receiverId or receiverType");
    }

    if (!["user", "driver"].includes(receiverType)) {
      throw new Error("Invalid receiver type");
    }

    const query = {
      where: { receiverId, receiverType },
      order: [["timestamp", "DESC"]],
    };

    if (status) {
      query.where.status = status; // Filter by status if provided
    }

    const notifications = await Notification.findAll(query);

    return notifications;
  } catch (error) {
    console.error("Error fetching notifications:", error.message);
    throw error;
  }
};

/**
 * Update the status of a notification.
 */
const updateNotificationStatus = async ({ notificationId, status }) => {
  try {
    if (!notificationId || !["pending", "delivered", "read"].includes(status)) {
      throw new Error("Invalid notification ID or status");
    }

    const notification = await Notification.findByPk(notificationId);

    if (!notification) {
      throw new Error("Notification not found");
    }

    await notification.update({ status });

    return notification;
  } catch (error) {
    console.error("Error updating notification status:", error.message);
    throw error;
  }
};

/**
 * Helper to send email and push notifications from the controllers.
 */
const sendNotificationFromController = async (req, res) => {
  try {
    const { receiverIds, receiverType, text, subject, metadata } = req.body;

    if (!receiverIds || !receiverType || !text) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const notifications = await sendNotification({ receiverIds, receiverType, text, subject, metadata });

    res.status(200).json({
      message: "Notifications sent successfully",
      notifications,
    });
  } catch (error) {
    console.error("Error in controller:", error.message);
    res.status(500).json({ message: "Error sending notifications", error });
  }
};

/**
 * Controller to fetch notifications.
 */
const getNotificationsController = async (req, res) => {
  try {
    const { receiverId, receiverType, status } = req.query;

    if (!receiverId || !receiverType) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const notifications = await getNotifications({ receiverId, receiverType, status });

    res.status(200).json({
      message: "Notifications retrieved successfully",
      notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error.message);
    res.status(500).json({ message: "Error fetching notifications", error });
  }
};

/**
 * Controller to update notification status.
 */
const updateNotificationStatusController = async (req, res) => {
  try {
    const { notificationId, status } = req.body;

    if (!notificationId || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const notification = await updateNotificationStatus({ notificationId, status });

    res.status(200).json({
      message: "Notification status updated successfully",
      notification,
    });
  } catch (error) {
    console.error("Error updating notification status:", error.message);
    res.status(500).json({ message: "Error updating notification status", error });
  }
};

module.exports = {
  sendNotification,
  getNotifications,
  updateNotificationStatus,
  sendNotificationFromController,
  getNotificationsController,
  updateNotificationStatusController,
};
