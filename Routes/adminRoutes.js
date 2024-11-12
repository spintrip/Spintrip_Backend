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
  sendNotification, adminProfile
} = require('../Controller/adminController/adminController');
const { createBlog, updateBlog, deleteBlog, getAllBlogs, getBlogById } = require('../Controller/blogController')

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


router.get('/cars', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    const cars = await Car.findAll();
    const carsWithAdditionalInfo = await Promise.all(cars.map(async (car) => {
      const additionalInfo = await CarAdditional.findOne({ where: { vehicleid: car.vehicleid } });
      return {
        ...car.toJSON(),
        additionalInfo: additionalInfo ? additionalInfo.toJSON() : null,
      };
    }));

    res.status(200).json({ message: "All available cars", cars: carsWithAdditionalInfo });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching cars', error });
  }
});

// Get Car by ID
router.get('/cars/:id', authenticate, async (req, res) => {
  try {
    const car = await Car.findByPk(req.params.id);
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    const additionalInfo = await CarAdditional.findOne({ where: { vehicleid: car.vehicleid } });

    res.status(200).json({
      car: {
        ...car.toJSON(),
        additionalInfo: additionalInfo ? additionalInfo.toJSON() : null,
      }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching car', error });
  }
});



// Update Car by ID
router.put('/cars/:vehicleid', authenticate, async (req, res) => {
  try {
    const { vehicleid } = req.params;
    const updateFields = {};
    const { additionalInfo, ...carData } = req.body;

    // Update Car data
    for (let key in carData) {
      if (carData.hasOwnProperty(key)) {
        updateFields[key] = carData[key];
      }
    }

    const [updated] = await Car.update(updateFields, { where: { vehicleid } });

    // if (!updated) {
    //   return res.status(404).json({ message: 'Car not found' });
    // }

    if (additionalInfo) {
      let additionalRecord = await CarAdditional.findOne({ where: { vehicleid } });

      if (additionalRecord) {
          await additionalRecord.update(additionalInfo);
      }
    }

    // Fetch updated car with additional info
    const updatedCar = await Car.findByPk(vehicleid);
    const updatedAdditionalInfo = await CarAdditional.findOne({ where: { vehicleid } });

    res.status(200).json({
      message: 'Car updated successfully',
      car: {
        ...updatedCar.toJSON(),
        additionalInfo: updatedAdditionalInfo ? updatedAdditionalInfo.toJSON() : null,
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating car', error });
  }
});

router.delete('/cars/:id', authenticate, async (req, res) => {
  try {
    await Car.destroy({ where: { vehicleid: req.params.id } });
    res.status(200).json({ message: 'Car deleted' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting car', error });
  }
});

router.get('/users/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch the additional info separately
    const additionalInfo = await UserAdditional.findOne({
      where: { id: user.id }
    });

    res.status(200).json({
      user: {
        ...user.toJSON(),
        additionalInfo: additionalInfo ? additionalInfo.toJSON() : null,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching user', error });
  }
});

router.get('/hosts', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const hosts = await Host.findAll();
    res.status(200).json({ "message": "All available Hosts", hosts });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching host', error });
  }
});

//Get all users
router.get('/users', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }


    const users = await User.findAll();
    const userAdditional = await UserAdditional.findAll();

    const usersWithAdditionalInfo = users.map(user => {
      const additionalInfo = userAdditional.find(additional => additional.id === user.id);
      return {
        ...user.toJSON(),  // Convert Sequelize model instance to plain object
        additionalInfo: additionalInfo ? additionalInfo.toJSON() : null
      };
    });

    res.status(200).json({ message: "All available Users", users: usersWithAdditionalInfo });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching users', error });
  }
});


router.put('/users/:id', authenticate, async (req, res) => {
  try {
    console.log(req.user.id);
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { additionalInfo, ...userData } = req.body;
    await user.update(userData);

    if (additionalInfo) {
      let additionalRecord = await UserAdditional.findOne({ where: { id: req.params.id } });

      if (additionalRecord) {
        await additionalRecord.update(additionalInfo);
      } 
    }

    // Fetch the updated user data and additional info separately
    const updatedUser = await User.findByPk(req.params.id);
    const updatedAdditionalInfo = await UserAdditional.findOne({ where: { id:  req.params.id  } });

    res.status(200).json({
      message: 'User updated successfully',
      user: {
        ...updatedUser.toJSON(),
        additionalInfo: updatedAdditionalInfo ? updatedAdditionalInfo.toJSON() : null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating user', error });
  }
});

router.get('/transaction', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const transactions = await Transaction.findAll();
    res.status(200).json({ "message": "All available transaction", transactions });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching transaction', error });
  }
})

router.get('/transaction/:id', authenticate, async (req, res) => {
  try {
    const transactions = await Transaction.findByPk(req.params.id);
    if (!transactions) {
      return res.status(404).json({ message: 'transaction not found' });
    }
    res.status(200).json({ transactions });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching booking', error });
  }
});

router.put('/transaction/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updatedFields = req.body;

    const transactions = await Transaction.findByPk(id);

    if (!transactions) {
      return res.status(404).json({ message: 'transaction not found' });
    }

    await transactions.update(updatedFields);

    res.status(200).json({ message: 'transaction updated successfully', transactions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating transaction', error });
  }
});


router.delete('/transaction/:id', authenticate, async (req, res) => {
  try {
    await Transaction.destroy({ where: { Transactionid: req.params.id } });
    res.status(200).json({ message: 'Transaction deleted' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting transaction', error });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const bookings = await Booking.findAll({
      where: { id: user.id },
      include: [{ model: Transaction, where: { Bookingid: Sequelize.col('Booking.Bookingid') }, required: false }], // Fetch related transactions
      raw: true
    });
    
    if (bookings && bookings.length > 0) {
      const auditBookings = bookings.map(booking => ({
        Bookingid: booking.Bookingid,
        Date: booking.Date,
        vehicleid: booking.vehicleid,
        time: booking.time,
        timestamp: booking.timestamp,
        id: booking.id,
        status: booking.status,
        amount: booking.amount,
        GSTAmount: booking.GSTAmount,
        insurance: booking.insurance,
        totalUserAmount: booking.totalUserAmount,
        TDSAmount: booking.TDSAmount,
        totalHostAmount: booking.totalHostAmount,
        Transactionid: booking.Transactionid,
        startTripDate: booking.startTripDate,
        endTripDate: booking.endTripDate,
        startTripTime: booking.startTripTime,
        endTripTime: booking.endTripTime,
        cancelDate: booking.cancelDate,
        cancelReason: booking.cancelReason,
        features: booking.features
      }));
    
      const auditTransactions = bookings
        .filter(booking => booking['Transactions.Transactionid']) 
        .map(booking => ({
          Transactionid: booking['Transactions.Transactionid'],
          Bookingid: booking.Bookingid,
          Date: booking['Transactions.Date'],
          time: booking['Transactions.time'],
          timestamp: booking['Transactions.timestamp'],
          id: booking['Transactions.id'],
          status: booking['Transactions.status'],
          amount: booking['Transactions.amount'],
          GSTAmount: booking['Transactions.GSTAmount'],
          totalAmount: booking['Transactions.totalAmount']
        }));
    
      await auditBooking.bulkCreate(auditBookings);
      await auditTransaction.bulkCreate(auditTransactions);
    }
    await user.destroy();
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting user', error });
  }
});

router.delete('/hosts/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Host not found' });
    }
    const host = await Host.findByPk(req.params.id);
    if(!host){
      return res.status(404).json({ message: 'Host not found' });
    }
    await user.destroy();
    res.status(200).json({ message: 'Host deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting user', error });
  }
});

router.post('/createBlog', authenticate, upload1.fields([{ name: 'blogImage_1', maxCount: 1 }, { name: 'blogImage_2', maxCount: 1 }]), createBlog);

router.post('/updateBlog', authenticate, upload1.fields([{ name: 'blogImage_1', maxCount: 1 }, { name: 'blogImage_2', maxCount: 1 }]), updateBlog);

router.get('/deleteBlog/:id', authenticate, deleteBlog);
router.get('/getAllBlogs', getAllBlogs);
router.get('/getBlogById/:id', getBlogById);
router.get('/device', async (req, res) => {
  const queryParams = req.query;
  try {
    // Create new device entry in the database
    const newDevice = await Device.create({
      deviceid: queryParams.id,
      lat: queryParams.lat,
      lng: queryParams.lng,
      speed: queryParams.speed,
      date: queryParams.date,
      time: queryParams.time,
    });

    console.log('Data saved to database successfully:', newDevice.toJSON());
    res.status(200).send('Payload saved successfully');
  } catch (error) {
    console.error('Error saving data to database:', error.message);
    res.status(500).send('Error saving data to database');
  }
});
router.get('/device/:id', async (req, res) => {
  const id = req.params.id;
  const limit = parseInt(req.query.limit, 10) || 10; 

  try {
    const results = await Device.findAll({
      where: {
        deviceid: id,
      },
      order: [['createdAt', 'DESC']],
      limit: limit, // Apply the limit
    });

    if (results.length === 0) {
      return res.status(404).send('No data found for the provided id');
    }

    res.json(results);
  } catch (error) {
    console.error('Error retrieving data from database:', error.message);
    res.status(500).send('Error retrieving data from database');
  }
});


router.post('/car-device', async (req, res) => {
  try {
    const { deviceid, vehicleid } = req.body;
    const car = await Car.findOne({
      where: {
        vehicleid: vehicleid,
      }})
    if(!car){
      return res.status(400).json({ message: 'Car not found' });
    }  
    const mapping = await carDevices.findOne({
      where: {
        [Op.or]: [
          { vehicleid: vehicleid },
          { deviceid: deviceid }
        ]
      }
    });
    if(mapping)
    {
      return res.status(400).json({ message: 'Car or device id already mapped' });
    }  
    const newMapping = await carDevices.create({ deviceid, vehicleid });

    res.status(201).json({ message: 'Mapping created successfully', newMapping });
  } catch (error) {
    console.error('Error creating mapping:', error.message);
    res.status(500).json({ message: 'Error creating mapping', error });
  }
});

// READ - Get all mappings
router.get('/car-device', async (req, res) => {
  try {
    const mappings = await carDevices.findAll();

    if (mappings.length === 0) {
      return res.status(404).json({ message: 'No mappings found' });
    }
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching mappings:', error.message);
    res.status(500).json({ message: 'Error fetching mappings', error });
  }
});

router.get('/car-device/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const mapping = await carDevices.findByPk(id);

    if (!mapping) {
      return res.status(404).json({ message: 'Mapping not found' });
    }
    res.json(mapping);
  } catch (error) {
    console.error('Error fetching mapping:', error.message);
    res.status(500).json({ message: 'Error fetching mapping', error });
  }
});


router.put('/car-device', async (req, res) => {

  const { deviceid, vehicleid } = req.body;

  try {
    const mapping = await carDevices.findByPk(deviceid);

    if (!mapping) {
      return res.status(404).json({ message: 'Mapping not found' });
    }
    const car = await Car.findOne({
      where: {
        vehicleid: vehicleid,
      }})
    if(!car){
      return res.status(400).json({ message: 'Car not found' });
    } 

    mapping.vehicleid = vehicleid !== undefined ? vehicleid : mapping.vehicleid;

    await mapping.save();

    res.json({ message: 'Mapping updated successfully', mapping });
  } catch (error) {
    console.error('Error updating mapping:', error.message);
    res.status(500).json({ message: 'Error updating mapping', error });
  }
});


router.delete('/car-device/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const mapping = await carDevices.findByPk(id);

    if (!mapping) {
      return res.status(404).json({ message: 'Mapping not found' });
    }

    await mapping.destroy();

    res.json({ message: 'Mapping deleted successfully' });
  } catch (error) {
    console.error('Error deleting mapping:', error.message);
    res.status(500).json({ message: 'Error deleting mapping', error });
  }
});

router.get('/pending-profile', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    let pendingProfiles = await UserAdditional.findAll({
      where: { verification_status: 1 }
    });

    if (pendingProfiles.length === 0) {
      return res.status(200).json({ message: 'No user approval required' });
    }

    const updatedProfiles = await Promise.all(
      pendingProfiles.map(async (profile) => {
        const user = await User.findByPk(profile.id);
        let userFolder = path.join('./uploads', profile.id.toString());
        let aadharFile = [];
        let dlFile = [];
        
        if (fs.existsSync(userFolder)) {
          let files = fs.readdirSync(userFolder);
          aadharFile = files.filter(file => file.includes('aadharFile')).map(file => `${process.env.BASE_URL}/uploads/${profile.id}/${file}`);
          dlFile = files.filter(file => file.includes('dlFile')).map(file => `${process.env.BASE_URL}/uploads/${profile.id}/${file}`);
        }
        
        return {
          ...profile.toJSON(),
          aadharFile: aadharFile[0] || null,
          dlFile: dlFile[0] || null,
          user: user ? user.toJSON() : null
        };
      })
    );

    res.status(200).json({ updatedProfiles });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching pending profiles', error });
  }
});


router.get('/pending-carprofile', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    let pendingProfiles = await CarAdditional.findAll({
      where: 
          { verification_status: 1 }
    });

    if (pendingProfiles.length === 0) {
      return res.status(200).json({ message: 'No car approval required' });
    }

    const updatedProfiles = await Promise.all(
      pendingProfiles.map(async (profile) => {
        const car = await Car.findByPk(profile.vehicleid);
        
        return {
          ...profile.toJSON(),
          car: car ? car.toJSON() : null
        };
      })
    );

    res.status(200).json({ pendingProfiles: updatedProfiles });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching pending car profiles', error });
  }
});

router.put('/approve-profile', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const userId = req.body.userId;
    await UserAdditional.update({ verification_status: 2 }, { where: { id: userId } });
    res.status(200).json({ message: 'Profile approved successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error approving profile', error });
  }
});

router.put('/approve-carprofile', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);
    if (!admin){
      return res.status(404).json({ message: 'Admin not found' });
    }
    const vehicleid = req.body.vehicleid;
    await CarAdditional.update({ verification_status: 2 }, { where: { vehicleid: vehicleid } });
    res.status(200).json({ message: 'Car Profile approved successfully' });
  } catch (error) {
    console.log(error);
    }
  });

router.put('/reject-profile', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const userId = req.body.userId;
    await UserAdditional.update({ dl: null , aadhar: null, verification_status: null }, { where: { id: userId } });
    res.status(200).json({ message: 'Profile rejected successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error rejected profile', error });
  }
});

router.put('/reject-carprofile', authenticate,  async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const vehicleid = req.body.vehicleid;
    await CarAdditional.update({ verification_status: null }, { where: { vehicleid: vehicleid } });
    res.status(200).json({ message: 'Car Profile rejected successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error in rejected Car profile', error });
  }
});

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

// Notification routes
router.post('/notifications', authenticate, sendNotification);

module.exports = router;
