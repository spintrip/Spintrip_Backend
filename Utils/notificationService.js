const admin = require('../firebaseConfig');

const sendPushNotification = async (fcmToken, title, body, dataPayload = {}) => {
  if (!fcmToken) return false;

  const message = {
    notification: {
      title: title,
      body: body
    },
    android: {
      notification: {
        icon: 'ic_launcher',
        color: '#FFFFFF'
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
