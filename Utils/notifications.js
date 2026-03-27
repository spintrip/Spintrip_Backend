const admin = require('firebase-admin');

/**
 * Initialize Firebase Admin SDK
 * Ensure GOOGLE_APPLICATION_CREDENTIALS is set in the .env file
 * or initialize with a service account object if preferred.
 */
try {
  // If FIREBASE_SERVICE_ACCOUNT_PATH is defined in .env, use it
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    console.log('Firebase Admin initialized successfully using service account file.');
  } else {
    // Fallback to default credentials (will use GOOGLE_APPLICATION_CREDENTIALS env var)
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    console.log('Firebase Admin initialized successfully using default credentials.');
  }
} catch (error) {
  console.warn('Firebase Admin initialization skipped or failed:', error.message);
}

/**
 * Send a push notification to a specific device token
 * @param {string} token - The FCM device token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional extra data payload
 */
const sendPushNotification = async (token, title, body, data = {}) => {
  if (!token) return false;
  
  const message = {
    notification: {
      title,
      body
    },
    android: {
      notification: {
        icon: 'ic_launcher',
        color: '#FFFFFF'
      }
    },
    data: {
      ...data,
      click_action: 'FLUTTER_NOTIFICATION_CLICK' // Standard for Flutter
    },
    token
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(`Successfully sent message to ${token}:`, response);
    return true;
  } catch (error) {
    console.error(`Error sending message to ${token}:`, error.message);
    return false;
  }
};

/**
 * Send push notification to multiple tokens
 */
const sendMulticastNotification = async (tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) return false;

  const message = {
    notification: { title, body },
    android: {
      notification: {
        icon: 'ic_launcher',
        color: '#FFFFFF'
      }
    },
    data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    tokens
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`${response.successCount} messages were sent successfully`);
    return true;
  } catch (error) {
    console.error('Error sending multicast message:', error.message);
    return false;
  }
};

module.exports = {
  sendPushNotification,
  sendMulticastNotification
};
