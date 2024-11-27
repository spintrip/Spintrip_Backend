const express = require("express");
const { authenticate } = require("../Middleware/authMiddleware");
const {
  driverSignup,
  verifyDriverOtp,
  driverKeepAlive,
  addDriver,
  assignDriverToVehicle,
} = require("../Controller/cabController");

const router = express.Router();

// Driver Routes
router.post("/driver/signup", authenticate, driverSignup);
router.post("/driver/verify-otp", verifyDriverOtp);
router.post("/driver/keep-alive", authenticate, driverKeepAlive);
// Host Routes
router.post("/add-driver", authenticate, addDriver);
router.post("/assign-driver", authenticate, assignDriverToVehicle);

module.exports = router;
