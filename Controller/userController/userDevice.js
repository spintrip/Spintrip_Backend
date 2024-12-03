const { User, Vehicle, Chat, UserAdditional, Listing, sequelize, Booking, Pricing,
    carFeature, Feedback, Host, Tax, Wishlist, Feature, Blog, Bike, Car, HostAdditional, VehicleAdditional, BookingExtension, Transaction } = require('../../Models');
  

const updateDeviceToken = async (req, res) => {
    try {
      const userId = req.user.id; // User ID from authentication middleware
      const { deviceToken } = req.body; // Device token from request body
  
      if (!deviceToken) {
        return res.status(400).json({ message: "Device token is required" });
      }
  
      const user = await User.findByPk(userId); // Find user by ID
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      await user.update({ deviceToken }); // Update the device token
  
      res.status(200).json({ message: "Device token updated successfully" });
    } catch (error) {
      console.error("Error updating device token:", error.message);
      res.status(500).json({ message: "Error updating device token", error: error.message });
    }
  };

  module.exports = { updateDeviceToken };
  