const express = require('express');
const { authenticate } = require('../Middleware/authMiddleware');
const { getAllBlogs } = require('../Controller/blogController');
const { initiatePayment, checkPaymentStatus, phonePayment, webhook } = require('../Controller/paymentController');
const { hostProfile , hostLogin , hostSignup, hostVerifyOtp, deleteHost, updateProfile, verifyProfile, 
  getActiveSubscriptionForVehicle, getAllSubscriptions, verifyProfileHandler, getListing, createListing, putListing, deleteListing ,postVehicle, putVehicleAdditional, uploadvehicleImages,
  postPricing, getVehicleAdditional, activateVehicle, tripstart, bookingcompleted, cancelbooking,
  hostBookings, postHostRating,postFeatures, allFeatures, updateFeatures, deleteFeatures,getBrand,deviceVehicleId,
  postMonthlyData,postGetFeedback, postGetVehicleReg
  } = require('../Controller/hostcontroller/hostController');
const router = express.Router();
const chatController = require('../Controller/chatController');
const { createSupportTicket, addSupportMessage, viewSupportChats, viewUserSupportTickets } = require('../Controller/supportController');

router.get('/get-brand', getBrand);

// Host Signup
router.post('/signup', hostSignup);

// Host Login
router.post('/login', authenticate, hostLogin);

//Verify-Otp
router.post('/verify-otp', hostVerifyOtp);
// Host Profile
router.get('/profile', authenticate, hostProfile);

router.put('/profile', authenticate, updateProfile);

// Put Verify
router.put('/verify', authenticate, verifyProfileHandler, verifyProfile );


// Add the required cabRoutes module
const cabRoutes = require('./cabRoutes');
router.use('/cab', cabRoutes);

// Modify the existing endpoint
router.post('/vehicle', authenticate, postVehicle);


//chat
router.post('/chat/send', chatController.sendMessage);
router.get('/chat/:bookingId', chatController.getMessagesByBookingId);

router.get('/delete_host', authenticate, deleteHost);

router.post('/createListing', authenticate, createListing);

router.put('/vehicleAdditional', authenticate, uploadvehicleImages, putVehicleAdditional);

router.get('/allfeatures', authenticate, allFeatures);
router.post('/features', authenticate, postFeatures);
// Update Feature
router.put('/features', authenticate, updateFeatures);

// Delete Feature
router.delete('/features', authenticate, deleteFeatures);

//Listing
router.get('/listing', authenticate, getListing);
router.put('/listing', authenticate, putListing);
router.post('/pricing', authenticate, postPricing);
//Delete Listing
router.delete('/listing', authenticate, deleteListing);



router.post('/monthly-data', authenticate, postMonthlyData);
router.post('/getCarReg', postGetVehicleReg);

//Host-Bookings
router.get('/host-bookings', authenticate, hostBookings);
router.post('/rating', authenticate, postHostRating);
router.post('/getFeedback', authenticate, postGetFeedback);
router.post('/getVehicleAdditional', authenticate, getVehicleAdditional);

router.get('/device/:vehicleid', authenticate, deviceVehicleId);

//Support for host
// Create a support ticket
router.post('/support', authenticate, createSupportTicket);

// Add a message to a support ticket
router.post('/support/message', authenticate, addSupportMessage);

router.post('/support/supportChat', authenticate, viewSupportChats);

router.get('/support', authenticate, viewUserSupportTickets);

router.get('/view-blog',authenticate, getAllBlogs );

router.post('/activate-vehicle', authenticate, activateVehicle);

router.post('/getallsubscription', authenticate, getAllSubscriptions);

router.get('/getActiveSubscription', authenticate, getActiveSubscriptionForVehicle);

router.post('/Trip-Started', authenticate, tripstart);

router.post('/booking-completed', authenticate, bookingcompleted);

router.post('/payment', authenticate,  initiatePayment);

router.post('/webhook/cashfree', checkPaymentStatus);

router.post('/phonepayment', authenticate, phonePayment );

router.post('/webhook/phonepe', webhook );

router.post('/Cancel-Booking', authenticate, cancelbooking);
module.exports = router;