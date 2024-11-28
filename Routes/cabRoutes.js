const express = require("express");
const { authenticate } = require("../Middleware/authMiddleware");
const {
  driverSignup,
  verifyDriverOtp,
  driverKeepAlive,
  addDriver,
  assignDriverToVehicle,
  updateDriverDeviceToken, 
} = require("../Controller/cabController");

const router = express.Router();

// Driver Routes
router.post("/driver/verify-otp", verifyDriverOtp);
router.post("/driver/keep-alive", authenticate, driverKeepAlive);
// Host Routes
router.post("/driver/update-device-token", authenticate, updateDriverDeviceToken); // Add route to update device token
router.post("/add-driver", authenticate, addDriver);
router.post("/assign-driver", authenticate, assignDriverToVehicle);

module.exports = router;
