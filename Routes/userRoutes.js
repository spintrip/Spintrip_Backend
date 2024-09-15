// userRoutes.js
const express = require('express');
const uuid = require('uuid');
const { authenticate, generateToken } = require('../Middleware/authMiddleware');
const bcrypt = require('bcrypt');
const {
  signup,
  login,
  generateOTP,
  sendOTP,
  razorpay,
  createIndex,
  verify,
  getprofile,
  putprofile,
  getbrand,
  features,
  cars,
  findcars,
  onecar,
  calculateTripHours,
  getBookingDetails,
  booking,
  postwishlist,
  cancelwishlist,
  getwishlist,
  getcaradditional,
  extend,
  breakup, 
  tripstart,
  autoCancelBooking,
  cancelbooking,
  userbookings,
  bookingcompleted,
  getfeedback,
  transactions,
  chat,
  chathistory,
  toprating,
  deleteuser,
  rating,
  getAllBookingExtensions,
 } = require('../Controller/userController');
const { getAllBlogs } = require('../Controller/blogController');
const { initiatePayment, checkPaymentStatus, phonePayment, webhook } = require('../Controller/paymentController');
const chatController = require('../Controller/chatController');
const { createSupportTicket, addSupportMessage, viewSupportChats, viewUserSupportTickets } = require('../Controller/supportController');
const { Op } = require('sequelize');
const multerS3 = require('multer-s3');
const s3 = require('../s3Config');
const crypto = require('crypto');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const csv = require('csv-parser');
const router = express.Router();
const { setTimeout } = require('timers/promises');

const {
  sendBookingConfirmationEmail,
  sendBookingApprovalEmail,
  sendTripStartEmail,
  sendTripEndEmail,
  sendPaymentConfirmationEmail,
  sendBookingCancellationEmail,
  sendBookingCompletionEmail
} = require('../Controller/emailController');
const ImageStorage = multerS3({
  s3: s3,
  bucket: 'spintrip-bucket',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const userId = req.user.id;
    const fileName = `${file.fieldname}${path.extname(file.originalname)}`;
    const filePath = `${userId}/${fileName}`;
    cb(null, filePath);
  }
});
const fs = require('fs');

const upload = multer({ storage: ImageStorage });

//Login
router.post('/login', login)

//Verify-OTP
router.post('/verify-otp', verify);

//Profile


router.get('/profile', authenticate, getprofile);

router.get('/extensions', authenticate, getAllBookingExtensions);


//Update Profile

router.put('/profile', authenticate, putprofile);

// Verify route with image resizing
router.put('/verify', authenticate, upload.fields([
  { name: 'aadharFile', maxCount: 1 },
  { name: 'dlFile', maxCount: 1 },
  { name: 'profilePic', maxCount: 1 }
]), async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let files = [];
    if (req.files) {
      if (req.files['aadharFile']) files.push(req.files['aadharFile'][0]);
      if (req.files['dlFile']) files.push(req.files['dlFile'][0]);
      if (req.files['profilePic']) files.push(req.files['profilePic'][0]);
    }

    const { dlFile, aadharFile, profilePic } = req.files;

    if (dlFile || aadharFile) {
      await UserAdditional.update({
        dl: dlFile ? dlFile[0].location : undefined,
        aadhar: aadharFile ? aadharFile[0].location : undefined,
        verification_status: 1
      }, { where: { id: userId } });
    }

    if (profilePic) {
      await UserAdditional.update({
        profilepic: profilePic[0].location,
      }, { where: { id: userId } });
    }

    res.status(200).json({ message: 'Profile Updated successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error updating profile', error: error });
  }
});

//Signup
router.post('/signup', signup);

router.get('/get-brand', getbrand);

router.post('/features', authenticate,);

//Get All Cars
router.get('/cars', cars);
//chat
router.post('/chat/send', chatController.sendMessage);
router.get('/chat/:bookingId', chatController.getMessagesByBookingId);
//Find Cars
router.post('/findcars', authenticate, findcars);
router.post('/onecar', onecar);
router.post('/booking', authenticate, booking);
router.post('/wishlist', authenticate, postwishlist);
router.post('/cancelwishlist', authenticate, cancelwishlist);

router.get('/wishlist', authenticate, getwishlist);
router.post('/getCarAdditional', getcaradditional);

router.post('/extend-booking', authenticate, extend);
//Trip-Started
router.post('/view-breakup', authenticate, breakup);

router.post('/Trip-Started', authenticate, tripstart);


//Cancel-Booking
router.post('/Cancel-Booking', authenticate, cancelbooking);

router.post('/getFeedback', authenticate, getfeedback);
//User-Bookings
router.get('/User-Bookings', authenticate, userbookings);

//Booking-Completed
router.post('/booking-completed', authenticate, bookingcompleted); ``

//Rating
router.post('/rating', authenticate, rating);

router.get('/delete_user', authenticate, deleteuser);
router.get('/top-rating', toprating);

router.post('/webhook/phonepe', webhook);
//Payment

// Initiate Payment Route
router.post('/payment', authenticate, initiatePayment);

router.post('/phonepayment', authenticate, phonePayment);

// Payment Status Check Route
router.post('/webhook/cashfree', checkPaymentStatus);

//chat
router.get('/chat/history', authenticate, chathistory);

// Create a new chat message from user to host
router.post('/chat', authenticate,chat);


//Support system for user
// Create a support ticket
router.post('/support', authenticate, createSupportTicket);

// Add a message to a support ticket
router.post('/support/message', authenticate, addSupportMessage);

router.post('/support/supportChat', authenticate, viewSupportChats);

router.get('/support', authenticate, viewUserSupportTickets);

router.get('/view-blog', getAllBlogs);

router.get('/transactions', authenticate, transactions);

module.exports = router;
