const admin = require('../firebaseConfig');
const { User } = require('../Models/index');

/**
 * Sends a push notification to a specific device.
 * @param {string} fcmToken - The target device's FCM token.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body.
 * @param {object} dataPayload - Any extra data to send (optional).
 * @param {boolean} isHighPriority - If true, triggers high-importance channel and sound.
 */
const sendPushNotification = async (fcmToken, title, body, dataPayload = {}, isHighPriority = false) => {
  if (!fcmToken) return false;

  const message = {
    notification: {
      title: title,
      body: body
    },
    // 🍏 iOS (APNs) Configuration
    apns: {
      payload: {
        aps: {
          alert: {
            title: title,
            body: body,
          },
          sound: isHighPriority ? 'alarm.caf' : 'default',
          badge: 1,
        },
      },
      headers: {
        'apns-priority': '10', // High priority for iOS
      },
    },
    // 🤖 Android Configuration
    android: {
      priority: 'high', // High priority for Android
      notification: {
        icon: 'ic_launcher',
        color: '#FFFFFF',
        sound: isHighPriority ? 'alarm' : 'default',
        priority: 'high',
        channel_id: isHighPriority ? 'high_importance_channel' : 'default',
      },
      data: dataPayload,
    },
    data: dataPayload,
    token: fcmToken
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(`Successfully sent ${isHighPriority ? 'High-Priority' : 'Normal'} message:`, response);
    return true;
  } catch (error) {
    console.log('Error sending message:', error);
    return false;
  }
};

/**
 * Generic helper to notify both Driver and Customer when a booking is allocated.
 */
const notifyBookingAllocation = async (bookingId, driverId, userId, isHighPriority = false) => {
  try {
    // 1. Notify Driver
    const driver = await User.findByPk(driverId);
    if (driver && driver.fcmToken) {
      await sendPushNotification(
        driver.fcmToken,
        "New Ride Assigned",
        `You have been assigned a new ride (ID: ${bookingId}). Check your upcoming trips!`,
        { bookingId, type: "assignment", click_action: "FLUTTER_NOTIFICATION_CLICK" },
        isHighPriority
      );
    } else {
      console.log(`Notification skipped: Driver ${driverId} has no fcmToken.`);
    }

    // 2. Notify Customer (Include driver name if possible)
    const customer = await User.findByPk(userId);
    if (customer && customer.fcmToken) {
      const driverName = driver ? (driver.name || "A driver") : "A driver";
      await sendPushNotification(
        customer.fcmToken,
        "Driver Assigned",
        `${driverName} has been assigned to your booking #${bookingId}. Your ride is confirmed!`,
        { bookingId, type: "status_update", click_action: "FLUTTER_NOTIFICATION_CLICK" },
        false // Usually normal priority for customer
      );
    }

    return true;
  } catch (error) {
    console.error("Error in notifyBookingAllocation:", error.message);
    return false;
  }
};

/**
 * Generic helper to notify a user by their ID.
 */
const notifyUserById = async (userId, title, body, dataPayload = {}, isHighPriority = false) => {
  try {
    const user = await User.findByPk(userId);
    if (user && user.fcmToken) {
      return await sendPushNotification(user.fcmToken, title, body, dataPayload, isHighPriority);
    }
    console.log(`Notification skipped: User ${userId} not found or has no fcmToken.`);
    return false;
  } catch (error) {
    console.error(`Error in notifyUserById (${userId}):`, error.message);
    return false;
  }
};

module.exports = { sendPushNotification, notifyBookingAllocation, notifyUserById };
