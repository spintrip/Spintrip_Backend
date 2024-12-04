const express = require('express');
const { authenticate } = require('../Middleware/authMiddleware');
const {
  adminLogin, verifyOTP,
  getAllUsers, getUserById, deleteUser, updateUser, getAllHosts, getHostById, deleteHost,
  getAllvehicles, getvehicleById, updatevehicleById, deletevehicleById, getAllListings, getListingById, updateListingById, deleteListingById,
  createPayout, getAllPayouts, getPayoutById, adminSignup, updatePayoutById, deletePayoutById,
  getAllBookings, getBookingById, updateBookingById, deleteBookingById,
  createOrUpdateBrand, getAllBrands, updateBrandById, getPricing, updatePricingById,
  createTax, getAllTaxes, updateTaxById, deleteTaxById, createFeature, getAllFeatures, deleteFeatureById,
  viewAllSupportTickets, replyToSupportTicket, escalateSupportTicket, resolveSupportTicket, viewAllChats,
  sendNotification, adminProfile, deleteBike, updateBike, bikeById, bikes, cars, carsById, updateCars, deleteCars,
  allTransactions, getTransactionById, updateTransactionById, deleteTransactionById,getDevice, getDeviceById,
  postCarDevice,getCarDevice, getCarDeviceById, updateCarDevice, deleteCarDeviceById, pendingProfile, approveProfile, 
  rejectProfile, pendingVehicleProfile, approveVehicleProfile, rejectVehicleProfile
} = require('../Controller/adminController/adminController');
const { createBlog, updateBlog, deleteBlog, getAllBlogs, getBlogById } = require('../Controller/blogController');

const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../s3Config');
const path = require('path');
const router = express.Router();

// Set up multer storage with S3
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'spintrip-bucket',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `brand/${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  })
});

const blogImageStorage = multerS3({
  s3: s3,
  bucket: 'spintrip-bucket',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = `blogImage_${uniqueSuffix}${path.extname(file.originalname)}`;
    cb(null, `blog/${fileName}`);
  }
});
const upload1 = multer({ storage: blogImageStorage });

router.post('/signup', adminSignup);

// Authentication routes
router.post('/login', adminLogin);
router.post('/verify-otp', verifyOTP);
router.get('/profile', authenticate, adminProfile);
// User routes
router.get('/users', authenticate, getAllUsers);
router.get('/users/:id', authenticate, getUserById);
router.delete('/users/:id', authenticate, deleteUser);
router.put('/users/:id', authenticate, updateUser);

// Host routes
router.get('/hosts', authenticate, getAllHosts);
router.get('/hosts/:id', authenticate, getHostById);
router.delete('/hosts/:id', authenticate, deleteHost);


router.get('/cars', authenticate, cars);
// Get Car by ID
router.get('/cars/:id', authenticate, carsById);
// Update Car by ID
router.put('/cars/:vehicleid', authenticate, updateCars);

router.delete('/cars/:id', authenticate, deleteCars);


router.get('/bike', authenticate, bikes);
// Get Car by ID
router.get('/bike/:id', authenticate, bikeById);
// Update Car by ID
router.put('/bike/:vehicleid', authenticate, updateBike);

router.delete('/bike/:id', authenticate, deleteBike);



router.get('/transaction', authenticate, allTransactions);

router.get('/transaction/:id', authenticate, getTransactionById);

router.put('/transaction/:id', authenticate, updateTransactionById);


router.delete('/transaction/:id', authenticate, deleteTransactionById);


router.post('/createBlog', authenticate, upload1.fields([{ name: 'blogImage_1', maxCount: 1 }, { name: 'blogImage_2', maxCount: 1 }]), createBlog);

router.post('/updateBlog', authenticate, upload1.fields([{ name: 'blogImage_1', maxCount: 1 }, { name: 'blogImage_2', maxCount: 1 }]), updateBlog);

router.get('/deleteBlog/:id', authenticate, deleteBlog);
router.get('/getAllBlogs', getAllBlogs);
router.get('/getBlogById/:id', getBlogById);
router.get('/device', getDevice);
router.get('/device/:id', getDeviceById);


router.post('/car-device', postCarDevice);

// READ - Get all mappings
router.get('/car-device', getCarDevice);

router.get('/car-device/:id', getCarDeviceById);


router.put('/car-device', updateCarDevice);


router.delete('/car-device/:id', deleteCarDeviceById);

router.get('/pending-profile', authenticate, pendingProfile);


router.put('/approve-profile', authenticate, approveProfile);
router.get('/pending-vehicleprofile', authenticate, pendingVehicleProfile);

router.put('/approve-vehicleprofile', authenticate, approveVehicleProfile);

router.put('/reject-profile', authenticate, rejectProfile);

router.put('/reject-vehicleprofile', authenticate, rejectVehicleProfile);

// vehicles routes
router.get('/vehicles', authenticate, getAllvehicles);
router.get('/vehicles/:id', authenticate, getvehicleById);
router.put('/vehicles/:id', authenticate, updatevehicleById);
router.delete('/vehicles/:id', authenticate, deletevehicleById);

// Listing routes
router.get('/listings', authenticate, getAllListings);
router.get('/listings/:id', authenticate, getListingById);
router.put('/listings/:id', authenticate, updateListingById);
router.delete('/listings/:id', authenticate, deleteListingById);

// Payment Host routes
// router.get('/hostPayments', authenticate, getAllHostPayments);
// router.get('/hostPayments/:id', authenticate, getHostPaymentsById);
// router.put('/hostPayments/:id', authenticate, updateHostPaymentsById);
// router.delete('/hostPayments/:id', authenticate, deleteHostPaymentsyId);

// Booking routes
router.get('/bookings', authenticate, getAllBookings);
router.get('/bookings/:id', authenticate, getBookingById);
router.put('/bookings/:id', authenticate, updateBookingById);
router.delete('/bookings/:id', authenticate, deleteBookingById);

// Brand routes
router.post('/brand', authenticate, upload.single('carImage'), createOrUpdateBrand);
router.get('/brands', authenticate, getAllBrands);
router.put('/brand/:id', authenticate, updateBrandById);

// Pricing routes
router.get('/pricing', authenticate, getPricing);
router.put('/pricing/:id', authenticate, updatePricingById);

// Tax routes
router.post('/tax', authenticate, createTax);
router.get('/taxes', authenticate, getAllTaxes);
router.put('/tax/:id', authenticate, updateTaxById);
router.delete('/tax/:id', authenticate, deleteTaxById);

// Feature routes
router.post('/feature', authenticate, createFeature);
router.get('/features', authenticate, getAllFeatures);
router.delete('/feature/:id', authenticate, deleteFeatureById);

// Support routes
router.get('/support-tickets', authenticate, viewAllSupportTickets);
router.post('/support-tickets/reply', authenticate, replyToSupportTicket);
router.post('/support-tickets/escalate', authenticate, escalateSupportTicket);
router.post('/support-tickets/resolve', authenticate, resolveSupportTicket);
router.get('/chats', authenticate, viewAllChats);
router.get('/support-chats/:ticketId', authenticate, viewAllChats);

// Notification routes
router.post('/notifications', authenticate, sendNotification);

module.exports = router;
