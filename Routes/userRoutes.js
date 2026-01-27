// userRoutes.js
const express = require('express');
const { authenticate } = require('../Middleware/authMiddleware');
 const {
  searchForCabs,
  bookCab,
  getEstimate,
} = require('../Controller/cabController');
const {signup , login, verify, getprofile, putprofile, uploadProfile, deleteuser,getbrand, features,findvehicles, onevehicle, getvehicleadditional,
   postwishlist, cancelwishlist, getwishlist, getallVehicles, booking, extend, breakup, cancelbooking, userbookings, getfeedback, transactions, rating,
   chat, chathistory,updateDeviceToken,toprating, postaddress , getaddress, findCabs
  } = require('../Controller/userController/userController');
const { getAllBlogs } = require('../Controller/blogController');
const chatController = require('../Controller/chatController');
const { createSupportTicket, addSupportMessage, viewSupportChats, viewUserSupportTickets } = require('../Controller/supportController');
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


const upload = multer({ storage: ImageStorage });

//Signup
router.post('/signup', signup);

//Login
router.post('/login', login)

//Verify-OTP
router.post('/verify-otp', verify);

//Profile
router.get('/profile', authenticate, getprofile);

//Update Profile
router.put('/profile', authenticate, putprofile);

// Verify route with image resizing
router.put('/verify', authenticate, upload.fields([ { name: 'aadharFile', maxCount: 1 },{ name: 'dlFile', maxCount: 1 },{ name: 'profilePic', maxCount: 1 }]), uploadProfile);

router.get('/delete_user', authenticate, deleteuser);

router.get('/get-brand', getbrand);

router.post('/features', authenticate,features);

//Get All Vehicles
router.get('/vehicles', getallVehicles);

//chat
router.post('/chat/send', chatController.sendMessage);
router.get('/chat/:bookingId', chatController.getMessagesByBookingId);

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
router.post('/search-cabs', authenticate, searchForCabs);
router.post('/get-estimate', authenticate, getEstimate);
router.post('/book-cab', authenticate, bookCab);
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

router.get('/view-blog', getAllBlogs);

router.get('/transactions', authenticate, transactions);
router.post('/update-device-token', authenticate, updateDeviceToken);

module.exports = router;