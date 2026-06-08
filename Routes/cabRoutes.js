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
  rejectBooking,
  createSoftBooking,
  superhostAssignDriver,
  confirmBankPayment,
  trackDriverLocation,
  toggleDriverStatus,
  cancelUnpaidBooking,
  refundBookingCoins,
  unassignDriverFromVehicle,
  createReturnTripListing,
  getReturnTripListings,
  bookReturnTrip,
  startTrip,
  endTrip,
  addCab,
  getBulkEstimates,
  updateDriverPreference,
  joinAirportQueue,
  leaveAirportQueue,
  getAirportQueueStatus
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
router.post("/getBulkEstimates", getBulkEstimates); // Open route for search estimates
router.post("/search-cabs", authenticate, searchForCabs); // Search for nearby cabs
router.post("/book-cab", authenticate, bookCab); // Direct booking with immediate confirmation
router.post("/soft-book", authenticate, createSoftBooking); // Create a soft booking
router.post("/accept-booking", authenticate, acceptBooking); // Driver accepts the booking
router.post("/reject-booking", authenticate, rejectBooking); // Driver rejects the booking
router.get("/booking-status/:bookingId", authenticate, checkBookingStatus); // Check booking status
// Superhost Routes
router.post("/superhost/assign", authenticate, superhostAssignDriver);

// Payment Routes
router.post("/pay/bank-transfer", authenticate, confirmBankPayment);

// Customer Tracking
router.get("/track/:bookingId", authenticate, trackDriverLocation);

// Outstation Return-Trip Marketplace Routes
router.post("/driver/return-trip", authenticate, createReturnTripListing);
router.get("/return-trips", authenticate, getReturnTripListings);
router.post("/book-return-trip", authenticate, bookReturnTrip);

// Driver Preference & Airport Command queue routes
router.put("/driver/preference", authenticate, updateDriverPreference);
router.post("/driver/airport/join-queue", authenticate, joinAirportQueue);
router.post("/driver/airport/leave-queue", authenticate, leaveAirportQueue);
router.get("/driver/airport/queue-status", authenticate, getAirportQueueStatus);

module.exports = router;
