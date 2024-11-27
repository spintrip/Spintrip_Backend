const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
const serviceAccount = require("../config/firebaseServiceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

/**
 * Send a push notification to a single device.
 * @param {string} deviceToken - The device token of the recipient.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body content of the notification.
 * @param {object} [data] - Optional additional data to send with the notification.
 * @returns {Promise<string>} - Returns the message ID on success.
 */
const sendPushNotification = async (deviceToken, title, body, data = {}) => {
  try {
    const message = {
      notification: {
        title,
        body,
      },
      data: data, // Optional additional data
      token: deviceToken,
    };

    const response = await admin.messaging().send(message);
    console.log("Push notification sent successfully:", response);
    return response;
  } catch (error) {
    console.error("Error sending push notification:", error.message);
    throw new Error("Failed to send push notification");
  }
};

/**
 * Send a push notification to multiple devices.
 * @param {string[]} deviceTokens - List of device tokens of the recipients.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body content of the notification.
 * @param {object} [data] - Optional additional data to send with the notification.
 * @returns {Promise<object>} - Returns the batch response with success and failure counts.
 */
const sendPushNotificationToMultipleDevices = async (deviceTokens, title, body, data = {}) => {
  try {
    const message = {
      notification: {
        title,
        body,
      },
      data: data, // Optional additional data
      tokens: deviceTokens,
    };

    const response = await admin.messaging().sendMulticast(message);
    console.log("Push notifications batch sent successfully:", response);
    return response;
  } catch (error) {
    console.error("Error sending push notifications:", error.message);
    throw new Error("Failed to send push notifications");
  }
};

module.exports = {
  sendPushNotification,
  sendPushNotificationToMultipleDevices,
};
