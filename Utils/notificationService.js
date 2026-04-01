const admin = require('../firebaseConfig');

/**
 * Sends a push notification to a specific device.
 * @param {string} fcmToken - The target device's FCM token.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body.
 * @param {object} dataPayload - Any extra data to send (optional).
 */
const sendPushNotification = async (fcmToken, title, body, dataPayload = {}) => {
  if (!fcmToken) return false;

  const message = {
    notification: {
      title: title,
      body: body
    },
    // 🍏 iOS (APNs) Configuration (CRITICAL for "Welcome" Alerts)
    apns: {
      payload: {
        aps: {
          alert: {
            title: title,
            body: body,
          },
          sound: 'default',
          badge: 1, // Shows the red dot on the app icon
        },
      },
    },
    // 🤖 Android Configuration
    android: {
      notification: {
        icon: 'ic_launcher',
        color: '#FFFFFF',
        priority: 'high',
      }
    },
    data: dataPayload,
    token: fcmToken
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
    return true;
  } catch (error) {
    console.log('Error sending message:', error);
    return false;
  }
};

module.exports = { sendPushNotification };
