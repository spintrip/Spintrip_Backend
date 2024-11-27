// userRoutes.js
const express = require('express');
const uuid = require('uuid');
const { authenticate, generateToken } = require('../Middleware/authMiddleware');
const bcrypt = require('bcrypt');
const { User, Vehicle, Chat, UserAdditional, Listing, sequelize, Booking, Pricing,
  carFeature, Feedback, Host, Tax, Wishlist, Feature, Blog, BookingExtension, Transaction } = require('../Models');
const {
  signup,
  login,
  generateOTP,
  sendOTP,
  createIndex,
  verify,
  getprofile,
  putprofile,
  getbrand,
  features,
  findvehicles,
  onevehicle,
  calculateTripHours,
  getBookingDetails,
  booking,
  postwishlist,
  cancelwishlist,
  getwishlist,
  getvehicleadditional,
  extend,
  breakup, 
  cancelbooking,
  userbookings,
  getfeedback,
  transactions,
  chat,
  chathistory,
  toprating,
  deleteuser,
  rating
 } = require('../Controller/userController');
 const {
  searchForCabs,
  bookCab,
  estimatePrice,

} = require('../Controller/cabController');
const { getAllBlogs } = require('../Controller/blogController');
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

router.post('/features', authenticate,features);

//Get All Vehicles
router.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll();
    res.status(200).json(vehicles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching vehicles' });
  }
});

//chat
router.post('/chat/send', chatController.sendMessage);
router.get('/chat/:bookingId', chatController.getMessagesByBookingId);

//Find Vehicles
router.post('/findvehicles', authenticate, findvehicles);
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
router.post('/get-estimate', authenticate, async (req, res) => {
  try {
    // Extract data from the request body
    const { origin, destination, vehicleId, trafficConditions } = req.body;

    // Validate the input
    if (!origin || !destination || !vehicleId) {
      return res.status(400).json({ message: "Missing required parameters: origin, destination, or vehicleId." });
    }

    // Call the estimatePrice function with the required parameters
    const result = await estimatePrice({ origin, destination, vehicleId, trafficConditions });

    // Return the result to the client
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in /get-estimate route:", error.message);
    res.status(500).json({ message: "Failed to estimate price.", error: error.message });
  }
});
router.post('/book-cab', authenticate, bookCab);
//end cab

//Cancel-Booking
router.post('/Cancel-Booking', authenticate, cancelbooking);

router.post('/getFeedback', authenticate, getfeedback);
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

module.exports = router;