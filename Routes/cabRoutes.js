const express = require("express");
const { authenticate } = require("../Middleware/authMiddleware");
const {
  verifyDriverOtp,
  driverKeepAlive,
  addDriver,
  assignDriverToVehicle,
  updateDriverDeviceToken,
  login,
  getDriver,
  searchForCabs,
  bookCab,
  checkBookingStatus,
  acceptBooking,
  createSoftBooking,
} = require("../Controller/cabController");

const router = express.Router();

// Driver Routes
router.post("/driver/verify-otp", verifyDriverOtp);
router.post("/driver/keep-alive", authenticate, driverKeepAlive);
router.post("/driver/login", login);
router.post("/driver/update-device-token", authenticate, updateDriverDeviceToken);

// Host Routes
router.post("/add-driver", authenticate, addDriver);
router.post("/assign-driver", authenticate, assignDriverToVehicle);
router.get("/host/drivers", authenticate, getDriver);

// Cab Booking Routes
router.post("/search-cabs", authenticate, searchForCabs); // Search for nearby cabs
router.post("/book-cab", authenticate, bookCab); // Direct booking with immediate confirmation
router.post("/soft-book", authenticate, createSoftBooking); // Create a soft booking
router.post("/accept-booking", authenticate, acceptBooking); // Driver accepts the booking
router.get("/booking-status/:bookingId", authenticate, checkBookingStatus); // Check booking status

module.exports = router;
