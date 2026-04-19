const express = require('express');
const { authenticate } = require('../Middleware/authMiddleware');
const {
  searchForCabs,
  bookCab,
  getEstimate,
  getBulkEstimates,
  getCabAvailability,
  cancelUnpaidBooking,
} = require('../Controller/cabController');

const { signup, login, verify, getprofile, putprofile, uploadProfile, deleteuser, getbrand, features, findvehicles, onevehicle, getvehicleadditional,
  postwishlist, cancelwishlist, getwishlist, getAllVehicleTypes, booking, extend, breakup, cancelbooking, userbookings, getfeedback, transactions, rating,
  chat, chathistory, updateDeviceToken, toprating, verifyAadhar, verifyDl, verifyPan, postaddress, getaddress, findCabs, getWalletDetails, initiateRecharge, walletWebhook, walletWithdraw
} = require('../Controller/userController/userController');
const { getAllBlogs, getBlogById } = require('../Controller/blogController');
const chatController = require('../Controller/chatController');
const { createSupportTicket, addSupportMessage, viewSupportChats, viewUserSupportTickets } = require('../Controller/supportController');
const { initiatePayment, initiateCabPayment, verifyCabPayment, checkPaymentStatus, phonePayment, webhook } = require('../Controller/paymentController');
const offerController = require('../Controller/userController/offerController');
const multerS3 = require('multer-s3');
const s3 = require('../s3Config');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const ImageStorage = multerS3({
  s3: s3,
  bucket: 'spintrip-s3bucket',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const userId = req.user.id;
    const fileName = `${file.fieldname}${path.extname(file.originalname)}`;
    const filePath = `${userId}/${fileName}`;
    cb(null, filePath);
  }
});


const upload = multer({ storage: ImageStorage, limits: { fileSize: 10 * 1024 * 1024 }  });

//Signup
router.post('/signup', signup);

router.get('/vehicle-types', getAllVehicleTypes);

//Login
router.post('/login', login)

//Verify-OTP
router.post('/verify-otp', verify);

//Profile
router.get('/profile', authenticate, getprofile);

//Update Profile
router.put('/profile', authenticate, putprofile);

// Verify route with image resizing
router.put('/verify', authenticate, upload.fields([{ name: 'aadharFile', maxCount: 1 }, { name: 'dlFile', maxCount: 1 }, { name: 'panFile', maxCount: 1 }, { name: 'profilePic', maxCount: 1 }]), uploadProfile);

router.get('/delete_user', authenticate, deleteuser);

router.get('/get-brand', getbrand);

router.post('/features', authenticate, features);

//Get All Vehicles
router.get('/vehicles', getAllVehicleTypes);

//chat
router.post('/chat/send', chatController.sendMessage);
router.get('/chat/:bookingId', chatController.getMessagesByBookingId);
// --- Add this line near your other cab routes (around line 95) ---


router.post('/get-bulk-estimates', getBulkEstimates);


//Find Vehicles
router.post('/findvehicles', authenticate, findvehicles);

router.post('/findcabs', authenticate, findCabs);
router.post('/onevehicle', onevehicle);

// Booking Route
router.post('/booking', authenticate, booking);

router.post('/wishlist', authenticate, postwishlist);
router.post('/cancelwishlist', authenticate, cancelwishlist);

router.get('/wishlist', authenticate, getwishlist);
router.post('/getVehicleAdditional', authenticate, getvehicleadditional);

router.post('/extend-booking', authenticate, extend);
//Trip-Started
router.post('/view-breakup', authenticate, breakup);

//cab booking
router.post('/cab-availability', getCabAvailability);
router.post('/search-cabs', authenticate, searchForCabs);
router.post('/get-estimate', getEstimate);
router.post('/book-cab', authenticate, bookCab);
router.post('/initiate-cab-payment', authenticate, initiateCabPayment);
router.get('/verify-cab-payment/:bookingId', authenticate, verifyCabPayment);
router.post('/cancel-unpaid-booking', authenticate, cancelUnpaidBooking);
//end cab

//Cancel-Booking
router.post('/Cancel-Booking', authenticate, cancelbooking);

router.post('/getFeedback', authenticate, getfeedback);

router.post('/postaddress', authenticate, postaddress);

router.get('/getAlladress', authenticate, getaddress);
//User-Bookings
router.get('/User-Bookings', authenticate, userbookings);

//Rating
router.post('/rating', authenticate, rating);

router.get('/delete_user', authenticate, deleteuser);
router.get('/top-rating', toprating);

//chat
router.get('/chat/history', authenticate, chathistory);

// Create a new chat message from user to host
router.post('/chat', authenticate, chat);

//Support system for user
// Create a support ticket
router.post('/support', authenticate, createSupportTicket);

// Add a message to a support ticket
router.post('/support/message', authenticate, addSupportMessage);

router.post('/support/supportChat', authenticate, viewSupportChats);

router.get('/support', authenticate, viewUserSupportTickets);

router.post('/update-device-token', authenticate, updateDeviceToken);

// Balance & Transaction Endpoints
router.get('/wallet', authenticate, getWalletDetails);
router.get('/transactions', authenticate, transactions);

// Blogs
router.get('/blogs', getAllBlogs);
router.get('/blogs/:id', getBlogById);

const { updateFcmToken } = require('../Controller/notificationController');
const { uploadvehicleImages, putVehicleAdditional } = require('../Controller/hostcontroller/hostController');
router.put('/fcm-token', authenticate, updateFcmToken);
router.put('/vehicle-images', authenticate, uploadvehicleImages, putVehicleAdditional);

// KYC Verification Routes
router.post('/verify-aadhar', authenticate, verifyAadhar);
router.post('/verify-pan', authenticate, verifyPan);
router.post('/verify-dl', authenticate, verifyDl);

// Offers & Promo Codes
router.get('/offers', authenticate, offerController.getAvailableOffers);
router.post('/apply-promo', authenticate, offerController.validateOffer);

module.exports = router;