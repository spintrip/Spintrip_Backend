// userRoutes.js
const express = require('express');
const uuid = require('uuid');
const { authenticate, generateToken } = require('../Middleware/authMiddleware');
const bcrypt = require('bcrypt');
const { User, Vehicle, Chat, UserAdditional, Listing, sequelize, Booking, Pricing, CarAdditional,
  carFeature, Feedback, Host, Tax, Wishlist, Feature, Blog, BookingExtension, Transaction } = require('../Models');
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
  vehicles,
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
  tripstart,
  cancelbooking,
  userbookings,
  bookingcompleted,
  getfeedback,
  transactions,
  chat,
  chathistory,
  toprating,
  deleteuser,
  rating
 } = require('../Controller/userController');
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

router.post('/features', authenticate,);

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
router.post('/booking', authenticate, async (req, res) => {
  try {
    const { vehicleid, startTripDate, endTripDate, startTripTime, endTripTime } = req.body;
    const userId = req.user.id;

    // Fetch vehicle and host details
    const vehicle = await Vehicle.findByPk(vehicleid);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    const host = await Host.findByPk(vehicle.hostId);
    if (!host) {
      return res.status(404).json({ message: 'Host not found' });
    }

    // Check if host requires verified users
    if (host.onlyVerifiedUsers) {
      const userAdditional = await UserAdditional.findOne({ where: { id: userId } });
      if (!userAdditional || userAdditional.verification_status !== 1) {
        return res.status(403).json({ message: 'Only verified users can book this vehicle' });
      }
    }

    // Create booking
    const bookingId = uuid.v4();
    const booking = await Booking.create({
      Bookingid: bookingId,
      vehicleid: vehicleid,
      id: userId,
      startTripDate: startTripDate,
      endTripDate: endTripDate,
      startTripTime: startTripTime,
      endTripTime: endTripTime,
      status: 1 // Assuming 1 means booked
    });

    res.status(201).json({ message: 'Booking created successfully', booking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating booking', error });
  }
});

router.post('/wishlist', authenticate, postwishlist);
router.post('/cancelwishlist', authenticate, cancelwishlist);

router.get('/wishlist', authenticate, getwishlist);
router.post('/getVehicleAdditional', getvehicleadditional);

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
router.post('/booking-completed', authenticate, bookingcompleted);

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