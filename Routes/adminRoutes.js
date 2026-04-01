const express = require('express');
const { authenticate, restrictToSuperadmin } = require('../Middleware/authMiddleware');
const {
  adminLogin, verifyOTP,
  getAllUsers, getUserById, deleteUser, updateUser, getAllHosts, getHostById, deleteHost,
  getAllvehicles, getvehicleById, updatevehicleById, deletevehicleById, getAllListings, getListingById, updateListingById, deleteListingById,
  createPayout, getAllPayouts, getPayoutById, adminSignup, updatePayoutById, deletePayoutById,
  getAllBookings, createAdminBooking, getBookingById, updateBookingById, deleteBookingById, cancelCabBooking, sendCabInvoice,
  createOrUpdateBrand, getAllBrands, updateBrandById, getPricing, updatePricingById,
  createTax, getAllTaxes, updateTaxById, deleteTaxById, createFeature, getAllFeatures, deleteFeatureById,
  viewAllSupportTickets, replyToSupportTicket, escalateSupportTicket, resolveSupportTicket, viewAllChats,
  sendNotification, adminProfile, deleteBike, updateBike, bikeById, bikes, cars, carsById, updateCars, deleteCars,
  allTransactions, getTransactionById, updateTransactionById, deleteTransactionById,getDevice, getDeviceById,
  pendingProfile, approveProfile, rejectProfile, pendingVehicleProfile, approveVehicleProfile, rejectVehicleProfile, subscriptions, postActiveVehicle,

  getAllFeedbacks, deleteFeedback,
  createVehicleType, getAllVehicleTypes, deleteVehicleType,
  createRecord, getAllRecords, getRecordById, updateRecord, deleteRecord,
  getAllCabs, getCabById, approveCabProfile, rejectCabProfile,
  getAllDrivers, getDriverById, approveDriverProfile, rejectDriverProfile,
  getAllWithdrawals, approveWithdrawal, rejectWithdrawal
} = require('../Controller/adminController/adminController');
const { createBlog, updateBlog, deleteBlog, getAllBlogs, getBlogById } = require('../Controller/blogController');
const { addCab, addDriver, assignDriverToVehicle } = require('../Controller/cabController');

const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../s3Config');
const path = require('path');
const router = express.Router();

// Set up multer storage with S3
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'spintrip-s3bucket',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `brand/${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  })
});

const blogImageStorage = multerS3({
  s3: s3,
  bucket: 'spintrip-s3bucket',
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
router.get('/users', authenticate, restrictToSuperadmin, getAllUsers);
router.get('/users/:id', authenticate, restrictToSuperadmin, getUserById);
router.delete('/users/:id', authenticate, restrictToSuperadmin, deleteUser);
router.put('/users/:id', authenticate, restrictToSuperadmin, updateUser);

// Removed broken duplicate Driver & Cab Admin routes
router.post('/cab/add-cab', authenticate, addCab);
router.post('/cab/add-driver', authenticate, addDriver);
router.post('/cab/assign-driver-vehicle', authenticate, assignDriverToVehicle);
// Add this function (perhaps near your new 'getAllVehicleTypes'):
const getAllCities = async (req, res) => {
  try {
    const { City } = require('../Models'); // Import City model here to avoid circular dependency
    const cities = await City.findAll({ where: { isActive: true } });
    res.status(200).json({ success: true, cities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DON'T FORGET to add 'getAllCities' to the module.exports at the bottom!

// Missing Frontend Render Routes for Drivers and Cabs Dashboard
router.get('/cabs', authenticate, getAllCabs);
// Add this route (around line 67):
router.get('/cities', getAllCities);

router.get('/cabs/:id', authenticate, getCabById);
router.put('/approve-cab/:id', authenticate, approveCabProfile);
router.put('/reject-cab/:id', authenticate, rejectCabProfile);

router.get('/drivers', authenticate, getAllDrivers);
router.get('/drivers/:id', authenticate, getDriverById);
router.put('/approve-driver/:id', authenticate, approveDriverProfile);
router.put('/reject-driver/:id', authenticate, rejectDriverProfile);

// Driver Withdrawal routes
router.get('/withdrawals', authenticate, restrictToSuperadmin, getAllWithdrawals);
router.put('/withdrawals/:id/approve', authenticate, restrictToSuperadmin, approveWithdrawal);
router.put('/withdrawals/:id/reject', authenticate, restrictToSuperadmin, rejectWithdrawal);
const { HostCabRateCard } = require('../Models');

const copyRatesToCities = async (req, res) => {
  try {
    const { sourceId, targetCities } = req.body; // targetCities is an array: ["Mumbai", "Pune"]
    
    // 1. Get the source record
    const sourceRecord = await HostCabRateCard.findByPk(sourceId);
    if (!sourceRecord) return res.status(404).json({ message: "Source rate card not found" });

    const results = [];
    const plainRecord = sourceRecord.get({ plain: true });
    delete plainRecord.id;
    delete plainRecord.createdAt;
    delete plainRecord.updatedAt;

    // 2. Clone to each target city
    for (const cityName of targetCities) {
      // Skip if it's the same city or empty
      if (cityName === sourceRecord.city || !cityName) continue;

      // Create or Update (Overwrite existing for that city/cabType combo)
      const [record, created] = await HostCabRateCard.findOrCreate({
        where: { city: cityName, cabType: sourceRecord.cabType },
        defaults: { ...plainRecord, city: cityName }
      });

      if (!created) {
        await record.update({ ...plainRecord, city: cityName });
      }
      results.push(cityName);
    }

    res.status(200).json({ success: true, message: `Copied to: ${results.join(', ')}`, cities: results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

router.post('/cab-rates/copy', authenticate, restrictToSuperadmin, copyRatesToCities);
// Feedback routes
router.get('/feedbacks', authenticate, restrictToSuperadmin, getAllFeedbacks);
router.delete('/feedbacks/:id', authenticate, restrictToSuperadmin, deleteFeedback);

// Vehicle Type routes
router.post('/vehicle-types', authenticate, restrictToSuperadmin, createVehicleType);
router.get('/vehicle-types', authenticate, restrictToSuperadmin, getAllVehicleTypes);
router.delete('/vehicle-types/:id', authenticate, restrictToSuperadmin, deleteVehicleType);

// Host routes
router.get('/hosts', authenticate, restrictToSuperadmin, getAllHosts);
router.get('/hosts/:id', authenticate, restrictToSuperadmin, getHostById);
router.delete('/hosts/:id', authenticate, restrictToSuperadmin, deleteHost);


router.get('/cars', authenticate, restrictToSuperadmin, cars);
// Get Car by ID
router.get('/cars/:id', authenticate, restrictToSuperadmin, carsById);
// Update Car by ID
router.put('/cars/:vehicleid', authenticate, restrictToSuperadmin, updateCars);

router.delete('/cars/:id', authenticate, restrictToSuperadmin, deleteCars);


router.get('/bike', authenticate, restrictToSuperadmin, bikes);
// Get Car by ID
router.get('/bike/:id', authenticate, restrictToSuperadmin, bikeById);
// Update Car by ID
router.put('/bike/:vehicleid', authenticate, restrictToSuperadmin, updateBike);

router.delete('/bike/:id', authenticate, restrictToSuperadmin, deleteBike);

router.post('/bookings/create', authenticate, restrictToSuperadmin, createAdminBooking);


router.get('/transaction', authenticate, restrictToSuperadmin, allTransactions);
router.get('/transaction/:id', authenticate, restrictToSuperadmin, getTransactionById);
router.put('/transaction/:id', authenticate, restrictToSuperadmin, updateTransactionById);
router.delete('/transaction/:id', authenticate, restrictToSuperadmin, deleteTransactionById);

router.post('/createBlog', authenticate, restrictToSuperadmin, upload1.fields([{ name: 'blogImage_1', maxCount: 1 }, { name: 'blogImage_2', maxCount: 1 }]), createBlog);
router.post('/updateBlog', authenticate, restrictToSuperadmin, upload1.fields([{ name: 'blogImage_1', maxCount: 1 }, { name: 'blogImage_2', maxCount: 1 }]), updateBlog);
router.get('/deleteBlog/:id', authenticate, restrictToSuperadmin, deleteBlog);
router.get('/getAllBlogs', authenticate, restrictToSuperadmin, getAllBlogs);
router.get('/getBlogById/:id', authenticate, restrictToSuperadmin, getBlogById);
router.get('/device', authenticate, restrictToSuperadmin, getDevice);
router.get('/device/:id', authenticate, restrictToSuperadmin, getDeviceById);
router.get('/activate-vehicle/:id', authenticate, restrictToSuperadmin, postActiveVehicle);
// router.get('/car-device', getCarDevice);

// router.get('/car-device/:id', getCarDeviceById);


// router.put('/car-device', updateCarDevice);


// router.delete('/car-device/:id', deleteCarDeviceById);

router.get('/pending-profile', authenticate, restrictToSuperadmin, pendingProfile);
router.put('/approve-profile', authenticate, restrictToSuperadmin, approveProfile);
router.put('/reject-profile', authenticate, restrictToSuperadmin, rejectProfile);

router.get('/pending-vehicleprofile', authenticate, restrictToSuperadmin, pendingVehicleProfile);
router.put('/approve-vehicleprofile', authenticate, restrictToSuperadmin, approveVehicleProfile);
router.put('/reject-vehicleprofile', authenticate, restrictToSuperadmin, rejectVehicleProfile);

// Cabs and Drivers Verification Routes
router.get('/cabs', authenticate, restrictToSuperadmin, getAllCabs);
router.get('/cabs/:id', authenticate, restrictToSuperadmin, getCabById);
router.put('/approve-cab/:id', authenticate, restrictToSuperadmin, approveCabProfile);
router.put('/reject-cab/:id', authenticate, restrictToSuperadmin, rejectCabProfile);

router.get('/drivers', authenticate, restrictToSuperadmin, getAllDrivers);
router.get('/drivers/:id', authenticate, restrictToSuperadmin, getDriverById);
router.put('/approve-driver/:id', authenticate, restrictToSuperadmin, approveDriverProfile);
router.put('/reject-driver/:id', authenticate, restrictToSuperadmin, rejectDriverProfile);

// vehicles routes
router.get('/vehicles', authenticate, restrictToSuperadmin, getAllvehicles);
router.get('/vehicles/:id', authenticate, restrictToSuperadmin, getvehicleById);
router.put('/vehicles/:id', authenticate, restrictToSuperadmin, updatevehicleById);
router.delete('/vehicles/:id', authenticate, restrictToSuperadmin, deletevehicleById);

// Listing routes
router.get('/listings', authenticate, restrictToSuperadmin, getAllListings);
router.get('/listings/:id', authenticate, restrictToSuperadmin, getListingById);
router.put('/listings/:id', authenticate, restrictToSuperadmin, updateListingById);
router.delete('/listings/:id', authenticate, restrictToSuperadmin, deleteListingById);

// Payment Host routes
// router.get('/hostPayments', authenticate, getAllHostPayments);
// router.get('/hostPayments/:id', authenticate, getHostPaymentsById);
// router.put('/hostPayments/:id', authenticate, updateHostPaymentsById);
// router.delete('/hostPayments/:id', authenticate, deleteHostPaymentsyId);

// Booking routes
router.get('/bookings', authenticate, restrictToSuperadmin, getAllBookings);
router.get('/bookings/:id', authenticate, restrictToSuperadmin, getBookingById);
router.put('/bookings/:id', authenticate, restrictToSuperadmin, updateBookingById);
router.delete('/bookings/:id', authenticate, restrictToSuperadmin, deleteBookingById);
router.put('/bookings/:id/cancel', authenticate, restrictToSuperadmin, cancelCabBooking);
router.post('/bookings/:id/send-invoice', authenticate, restrictToSuperadmin, sendCabInvoice);

router.post('/Subscriptions', authenticate, restrictToSuperadmin, subscriptions);

// Brand routes
router.post('/brand', authenticate, restrictToSuperadmin, upload.single('carImage'), createOrUpdateBrand);
router.get('/brands', authenticate, restrictToSuperadmin, getAllBrands);
router.put('/brand/:id', authenticate, restrictToSuperadmin, updateBrandById);

// Pricing routes
router.get('/pricing', authenticate, restrictToSuperadmin, getPricing);
router.put('/pricing/:id', authenticate, restrictToSuperadmin, updatePricingById);

// Tax routes
router.post('/tax', authenticate, restrictToSuperadmin, createTax);
router.get('/taxes', authenticate, restrictToSuperadmin, getAllTaxes);
router.put('/tax/:id', authenticate, restrictToSuperadmin, updateTaxById);
router.delete('/tax/:id', authenticate, restrictToSuperadmin, deleteTaxById);

// Feature routes
router.post('/feature', authenticate, restrictToSuperadmin, createFeature);
router.get('/features', authenticate, restrictToSuperadmin, getAllFeatures);
router.delete('/feature/:id', authenticate, restrictToSuperadmin, deleteFeatureById);

// Support routes
router.get('/support-tickets', authenticate, restrictToSuperadmin, viewAllSupportTickets);
router.post('/support-tickets/reply', authenticate, restrictToSuperadmin, replyToSupportTicket);
router.post('/support-tickets/escalate', authenticate, restrictToSuperadmin, escalateSupportTicket);
router.post('/support-tickets/resolve', authenticate, restrictToSuperadmin, resolveSupportTicket);
router.get('/chats', authenticate, restrictToSuperadmin, viewAllChats);
router.get('/support-chats/:ticketId', authenticate, restrictToSuperadmin, viewAllChats);

// Notification routes
router.post('/notifications', authenticate, restrictToSuperadmin, sendNotification);

// ----------------------------------------------------------------------
// GENERIC CRUD ROUTES FOR ALL MODELS
// ----------------------------------------------------------------------
router.post('/crud/:modelName', authenticate, restrictToSuperadmin, createRecord);
router.get('/crud/:modelName', authenticate, restrictToSuperadmin, getAllRecords);
router.get('/crud/:modelName/:id', authenticate, restrictToSuperadmin, getRecordById);
router.put('/crud/:modelName/:id', authenticate, restrictToSuperadmin, updateRecord);
router.delete('/crud/:modelName/:id', authenticate, restrictToSuperadmin, deleteRecord);

module.exports = router;
