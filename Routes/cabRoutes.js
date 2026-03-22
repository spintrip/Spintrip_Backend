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
  superhostAssignDriver,
  confirmBankPayment,
  trackDriverLocation,
  toggleDriverStatus,
  startTrip,
  endTrip,
  addCab,
} = require("../Controller/cabController");
const { updateFcmToken } = require('../Controller/notificationController');

const router = express.Router();

// Driver Routes
router.post("/driver/verify-otp", verifyDriverOtp);
router.post("/driver/keep-alive", authenticate, driverKeepAlive);
router.put("/driver/status", authenticate, toggleDriverStatus);
router.post("/driver/login", login);
router.post("/driver/update-device-token", authenticate, updateDriverDeviceToken);
router.post("/driver/start-trip", authenticate, startTrip);
router.post("/driver/end-trip", authenticate, endTrip);

// FCM Token Update
router.put('/fcm-token', authenticate, updateFcmToken);

// Host Routes
router.post("/add-driver", authenticate, addDriver);
router.post("/assign-driver", authenticate, assignDriverToVehicle);
router.post("/add-cab", authenticate, addCab);
router.get("/host/drivers", authenticate, getDriver);

// Cab Booking Routes
router.post("/search-cabs", authenticate, searchForCabs); // Search for nearby cabs
router.post("/book-cab", authenticate, bookCab); // Direct booking with immediate confirmation
router.post("/soft-book", authenticate, createSoftBooking); // Create a soft booking
router.post("/accept-booking", authenticate, acceptBooking); // Driver accepts the booking
router.get("/booking-status/:bookingId", authenticate, checkBookingStatus); // Check booking status
// Superhost Routes
router.post("/superhost/assign", authenticate, superhostAssignDriver);

// Payment Routes
router.post("/pay/bank-transfer", authenticate, confirmBankPayment);

// Customer Tracking
router.get("/track/:bookingId", authenticate, trackDriverLocation);

module.exports = router;
