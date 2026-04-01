const { User, Host, Driver } = require('../Models');
const { sendPushNotification } = require('../Utils/notificationService');

const updateFcmToken = async (req, res) => {
  try {
    const { fcmToken, role } = req.body;
    const userId = req.user.id; // from auth middleware

    if (!fcmToken) {
      return res.status(400).json({ message: "FCM token is required" });
    }

    // Centralize all tokens in the User table for a single source of truth
    await User.update({ fcmToken }, { where: { id: userId } });
    
    // Optional: Also update specialized tables for extra safety, though User is the primary source
    if (role === 'host') {
      await Host.update({ fcmToken }, { where: { id: userId } }).catch(e => console.log("Host token update skipped:", e.message));
    } else if (role === 'driver') {
      await Driver.update({ fcmToken }, { where: { id: userId } }).catch(e => console.log("Driver token update skipped:", e.message));
    }

    // Fire Welcome Back Notification seamlessly!
    await sendPushNotification(fcmToken, "Welcome to Spintrip!", "You have successfully logged in and push notifications are active!");

    return res.status(200).json({ message: "FCM token updated successfully natively securely" });
  } catch (error) {
    console.error("Error updating FCM token:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

module.exports = { updateFcmToken };
