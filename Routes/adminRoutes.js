const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../Middleware/authMiddleware');
const { User, Admin, UserAdditional, Booking, Host, Car, Brand, Pricing, Listing, CarAdditional, Tax, Device, Feature, carDevices, Transaction } = require('../Models');
const path = require('path');
const uuid = require('uuid');
const { sendOTP, generateOTP, authAdmin, client } = require('../Controller/adminController');
const fs = require('fs');
const router = express.Router();
const chatController = require('../Controller/chatController');
const { viewSupportTickets, replyToSupportTicket, escalateSupportTicket, resolveSupportTicket, viewSupportChats } = require('../Controller/supportController');
const { createBlog, updateBlog, deleteBlog, getAllBlogs, getBlogById } = require('../Controller/blogController')
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csv = require('csv-parser');
const multerS3 = require('multer-s3');
const s3 = require('../s3Config');
const { Op } = require('sequelize');
const { sendEmail } = require('../Controller/emailController');

const pricing1 = async (car, carAdditional) => {
  try {
    const currentYear = new Date().getFullYear();
    let brand = await Brand.findOne({
      where: { type: car.type, brand: car.brand },
    });

    if (brand) {
      brand_value = brand.brand_value;
      base_price = brand.base_price;
    }
    else {
      brand_value = 10;
      base_price = 100;
    }

    let val, horsePower;

    if ((car.Registrationyear.substring(0, 4) < 2018)) {
      val = (currentYear - car.Registrationyear.substring(0, 4)) * 3;
    }
    else {
      val = (currentYear - car.Registrationyear.substring(0, 4)) * 1.5;
    }
    if ((carAdditional.HorsePower <= 80) || (!carAdditional.HorsePower)) {
      horsePower = 0;
    }
    else if ((carAdditional.HorsePower > 80 && carAdditional.HorsePower < 150)) {
      horsePower = 20;
    }
    else {
      horsePower = 30;
    }
    let Price;
    let Sevenseater;
    if (car.type === 'SUV') {
      Sevenseater = 30;
    }
    else {
      Sevenseater = 15;
    }
    if (car.type === 'Hatchback') {
      Price = brand_value + horsePower +
        3 * (carAdditional.AC ? 1 : 0) + 3 * (carAdditional.Musicsystem ? 1 : 0) + 2 * (carAdditional.Autowindow ? 1 : 0) +
        2 * (carAdditional.Sunroof ? 1 : 0) + 2 * (carAdditional.touchScreen ? 1 : 0) + 15 * (carAdditional.Sevenseater ? 1 : 0) +
        2 * (carAdditional.Reversecamera ? 1 : 0) + 3 * (carAdditional.Transmission ? 1 : 0) + 10 * (carAdditional.FuelType ? 1 : 0) +
        2 * (carAdditional.Airbags ? 1 : 0) - val + base_price;
      return Price;
    }
    else {
      Price = brand_value + horsePower +
        5 * (carAdditional.AC ? 1 : 0) + 5 * (carAdditional.Musicsystem ? 1 : 0) + 2 * (carAdditional.Autowindow ? 1 : 0) +
        2 * (carAdditional.Sunroof ? 1 : 0) + 2 * (carAdditional.touchScreen ? 1 : 0) + Sevenseater * (carAdditional.Sevenseater ? 1 : 0) +
        2 * (carAdditional.Reversecamera ? 1 : 0) + 5 * (carAdditional.Transmission ? 1 : 0) + 10 * (carAdditional.FuelType ? 1 : 0) +
        2 * (carAdditional.Airbags ? 1 : 0) - val + base_price;
      return Price;
    }

  } catch (error) {
    console.error(error);
  }
};
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

// Initialize CSV writer
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const csvFilePath = path.join(dataDir, 'brands.csv');
const csvWriter = createCsvWriter({
  path: csvFilePath,
  header: [
    { id: 'brand', title: 'Brand' },
    { id: 'imagePath', title: 'ImagePath' }
  ],
  append: true // Append to the file instead of overwriting
});

router.post('/login', async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ where: { phone } });
    const admin = await Admin.findOne({ where: { id: user.id } });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid phone number' });
    }
    const otp = generateOTP();
    sendOTP(phone, otp);
    await user.update({ otp: otp })
    return res.json({ message: 'OTP sent successfully', redirectTo: '/verify-otp', phone, otp });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error logging in', error });
  }
});

//Verify-Otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const user = await User.findOne({ where: { phone } })
    const fixed_otp = user.otp;
    if (fixed_otp === otp) {
      const user = await User.findOne({ where: { phone } });
      const token = jwt.sign({ id: user.id, role: 'admin' }, 'your_secret_key');
      return res.json({ message: 'OTP verified successfully', user, token });
    } else {
      return res.status(401).json({ message: 'Invalid OTP' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Admin Signup
router.post('/signup', async (req, res) => {
  const { phone, password, securityQuestion } = req.body;

  try {
    const user = await User.findOne({ where: { phone } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the Admin table with the user's ID and other properties
    const admin = await Admin.create({
      id: user.id, // Link to the user in the User table
      securityQuestion,
      timestamp: new Date(), // Set the current timestamp
      password: hashedPassword,
      UserId: user.id,
      role: 'Admin'
    });

    res.status(201).json({ message: 'Admin created', admin });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating admin' });
  }
});

// Admin Profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const additionalinfo = await UserAdditional.findByPk(adminId)

    res.json({ phone: admin.phone, securityQuestion: admin.SecurityQuestion, additionalinfo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error });
  }
});
// Chat routes
router.get('/chat/all', chatController.getAllMessages);
router.post('/chat/flag/:messageId', chatController.flagMessage);
//Get All Cars
router.get('/cars', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const cars = await Car.findAll();
    res.status(200).json({ "message": "All available cars", cars });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching cars', error });
  }
})

router.get('/cars/:id', authenticate, async (req, res) => {
  try {
    const car = await Car.findByPk(req.params.id);
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }
    res.status(200).json({ car });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching car', error });
  }
});

router.put('/cars/:carid', authenticate, async (req, res) => {
  try {
    const { carid } = req.params;
    const updateFields = {};

    // Map request body to model fields
    if (req.body.carmodel) updateFields.carmodel = req.body.carmodel;
    if (req.body.type) updateFields.type = req.body.type;
    if (req.body.brand) updateFields.brand = req.body.brand;
    if (req.body.variant) updateFields.variant = req.body.variant;
    if (req.body.color) updateFields.color = req.body.color;
    if (req.body.chassisno) updateFields.chassisno = req.body.chassisno;
    if (req.body.Rcnumber) updateFields.Rcnumber = req.body.Rcnumber;
    if (req.body.mileage) updateFields.mileage = req.body.mileage;
    if (req.body.Enginenumber) updateFields.Enginenumber = req.body.Enginenumber;
    if (req.body.Registrationyear) updateFields.Registrationyear = req.body.Registrationyear;
    if (req.body.bodytype) updateFields.bodytype = req.body.bodytype;
    if (req.body.timestamp) updateFields.timestamp = req.body.timestamp;
    if (req.body.rating) updateFields.rating = req.body.rating;
    if (req.body.hostId) updateFields.hostId = req.body.hostId;

    const [updated] = await Car.update(updateFields, {
      where: { carid }
    });

    if (updated) {
      const updatedCar = await Car.findByPk(carid);
      res.status(200).json({ message: 'Car updated successfully', car: updatedCar });
    } else {
      res.status(404).json({ message: 'Car not found' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error updating car', error });
  }
});

// router.delete('/cars/:id', authenticate, async (req, res) => {
//   try {
//     await Car.destroy({ where: { id: req.params.id } });
//     res.status(200).json({ message: 'Car deleted' });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ message: 'Error deleting car', error });
//   }
// });

router.get('/users/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching user', error });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    await user.destroy();
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting user', error });
  }
});

router.get('/listings', authenticate, async (req, res) => {
  try {
    const listings = await Listing.findAll();
    res.status(200).json({ message: 'All available Listings', listings });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching listings', error });
  }
});

router.get('/listings/:id', authenticate, async (req, res) => {
  try {
    const listing = await Listing.findByPk(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }
    res.status(200).json({ listing });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching listing', error });
  }
});

router.put('/listings/:id', authenticate, async (req, res) => {
  try {
    const listing = await Listing.update(req.body, { where: { id: req.params.id } });
    res.status(200).json({ message: 'Listing updated', listing });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error updating listing', error });
  }
});

// router.delete('/listings/:id', authenticate, async (req, res) => {
//   try {
//     await Listing.destroy({ where: { id: req.params.id } });
//     res.status(200).json({ message: 'Listing deleted' });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ message: 'Error deleting listing', error });
//   }
// });
//Get All Bookings
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
router.get('/bookings', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const bookings = await Booking.findAll();
    res.status(200).json({ "message": "All available Bookings", bookings });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching bookings', error });
  }
})

router.get('/bookings/:id', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.status(200).json({ booking });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching booking', error });
  }
});

router.put('/bookings/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updatedFields = req.body;

    const booking = await Booking.findByPk(id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    await booking.update(updatedFields);

    res.status(200).json({ message: 'Booking updated successfully', booking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating booking', error });
  }
});


router.delete('/bookings/:id', authenticate, async (req, res) => {
  try {
    await Booking.destroy({ where: { Bookingid: req.params.id } });
    res.status(200).json({ message: 'Booking deleted' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting booking', error });
  }
});
//Get All Hosts
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
    res.status(200).json({ "message": "All available Users", users })
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching user', error });
  }
});

router.put('/users/:id', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    const { phone, password, role, otp, timestamp, status, rating } = req.body;

    const admin = await Admin.findByPk(adminId);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    let user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.phone = phone !== undefined ? phone : user.phone;
    user.password = password !== undefined ? password : user.password;
    user.role = role !== undefined ? role : user.role;
    user.otp = otp !== undefined ? otp : user.otp;
    user.timestamp = timestamp !== undefined ? timestamp : user.timestamp;
    user.status = status !== undefined ? status : user.status;
    user.rating = rating !== undefined ? rating : user.rating;

    await user.save();

    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error updating user', error });
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
      where: { verification_status: 1 },
    });
    if (pendingProfiles.length === 0) {
      res.status(200).json({ message: 'No user approval required' });
    }
    else {
      const updatedProfiles = await Promise.all(
        pendingProfiles.map(async (item) => {
          let id = item.id;
          console.log(id);
          let userId = id;
          let userFolder = path.join('./uploads', userId);
          if (fs.existsSync(userFolder)) {
            // List all files in the user's folder
            let files = fs.readdirSync(userFolder);
            if (files) {
              // Filter and create URLs for Aadhar and DL files
              let aadharFile = files.filter(file => file.includes('aadharFile')).map(file => `${process.env.BASE_URL}/uploads/${userId}/${file}`);
              let dlFile = files.filter(file => file.includes('dlFile')).map(file => `${process.env.BASE_URL}/uploads/${userId}/${file}`);
              console.log(aadharFile[0], dlFile);
              return { ...item.toJSON(), aadharFile: aadharFile[0], dlFile: dlFile[0] };
            }
          }
          return item.toJSON();
        }
        ));
      res.status(200).json({ updatedProfiles });
    }
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
      where: {
        [Op.or]: [
          { verification_status: 1 },
          { verification_status: null }
        ]
      }
    });
    if (pendingProfiles.length === 0) {
      res.status(200).json({ message: 'No car approval required' });
    }
      res.status(200).json({ pendingProfiles });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching pending profiles', error });
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
    const carId = req.body.carId;
    await CarAdditional.update({ verification_status: 2 }, { where: { carid: carId } });
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
    const carId = req.body.carId;
    await CarAdditional.update({ verification_status: null }, { where: { carid: carId } });
    res.status(200).json({ message: 'Car Profile rejected successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error in rejected Car profile', error });
  }
});

router.post('/new-brand', upload.single('carImage'), async (req, res) => {
  try {
    const { brand } = req.body;
    const carImage = req.file;

    if (!brand) {
      return res.status(400).json({ message: 'Brand is required' });
    }

    let imagePath;
    if (carImage) {
      imagePath = `https://spintrip-bucket.s3.amazonaws.com/${carImage.key}`;
    } else {
      imagePath = '';
    }

    let brands = [];

    if (fs.existsSync(csvFilePath)) {
      const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
      brands = csvContent.split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
          const [brandField, imagePathField] = line.split(',');
          return { brand: brandField, imagePath: imagePathField };
        });
    }

    const brandIndex = brands.findIndex(b => b.brand === brand);
    if (brandIndex > -1) {
      brands[brandIndex].imagePath = imagePath;
    } else {
      brands.push({ brand, imagePath });
    }

    const csvLines = brands.map(b => `${b.brand},${b.imagePath}`).join('\n');
    fs.writeFileSync(csvFilePath, csvLines);

    res.status(200).json({ message: 'Brand added/updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error in creating/updating brand', error });
  }
});
router.put('/brand', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const { data } = req.body;
    const createdBrands = [];
    console.log(data);
    data.forEach(async (item) => {
      const { type, brand, carmodel, brand_value, base_price } = item;
      console.log(item);
      let brands = await Brand.create({
        type: type,
        brand: brand,
        carmodel: carmodel,
        brand_value: brand_value,
        base_price: base_price
      });
      createdBrands.push(brands);
    });
    res.status(200).json({ message: 'Car Brand and Value added successfully', createdBrands });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error adding Car Brand and value', error });
  }
});
router.put('/update_brand', authenticate, async (req, res) => {
  try {
    const { id, type, brand, carmodel, brand_value, base_price } = req.body;
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    let brands = await Brand.update({
      type: type,
      brand: brand,
      brand_value: brand_value,
      base_price: base_price
    },
      { where: { id: id } }
    );
    res.status(200).json({ message: 'Car Brand and Value updated successfully', brands });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error adding Car Brand and value', error });
  }
});
router.post('/tax', async (req, res) => {
  try {
    const { GST, HostGST, TDS, Commission, insurance } = req.body;

    let tax = await Tax.create({
      GST: GST,
      HostGST: HostGST,
      TDS: TDS,
      Commission: Commission,
      insurance: insurance
    }
    );
    res.status(200).json({ message: 'Tax Updated', tax });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error adding Car Brand and value', error });
  }
});

router.get('/tax', async (req, res) => {
  try {
    const taxes = await Tax.findAll();
    res.status(200).json({ message: 'Tax records retrieved', taxes });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error retrieving Tax records', error });
  }
});

router.put('/tax/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { GST, HostGST, TDS, Commission, insurance } = req.body;

    let tax = await Tax.findByPk(id);
    if (!tax) {
      return res.status(404).json({ message: 'Tax record not found' });
    }

    tax.GST = GST !== undefined ? GST : tax.GST;
    tax.HostGST = HostGST !== undefined ? HostGST : tax.HostGST;
    tax.TDS = TDS !== undefined ? TDS : tax.TDS;
    tax.Commission = Commission !== undefined ? Commission : tax.Commission;
    tax.insurance = insurance !== undefined ? insurance: tax.insurance;

    await tax.save();

    res.status(200).json({ message: 'Tax Updated', tax });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error updating Tax', error });
  }
});


router.delete('/tax/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let tax = await Tax.findByPk(id);
    if (!tax) {
      return res.status(404).json({ message: 'Tax record not found' });
    }

    await tax.destroy();

    res.status(200).json({ message: 'Tax Deleted' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting Tax', error });
  }
});

router.get('/brand', authenticate, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const brands = await Brand.findAll();
    res.status(200).json({ "message": "All available brands", brands })
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error adding Car Brand and value', error });
  }
});
router.put('/update_brand', authenticate, async (req, res) => {
  try {
    const { id, type, brand, carmodel, brand_value, base_price } = req.body;
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    let brands = await Brand.update({
      brand_value: brand_value,
      base_price: base_price
    },
      { where: { id: id } }
    );
    res.status(200).json({ message: 'Car Brand and Value updated successfully', brands });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error adding Car Brand and value', error });
  }
});

router.get('/pricing', authenticate, async (req, res) => {
 try{ 
  const adminId = req.user.id;
  const admin = await Admin.findByPk(adminId);

  if (!admin) {
    return res.status(404).json({ message: 'Admin not found' });
  }
  const pricing = await Pricing.findAll();
  res.status(200).json({ "message": "Car pricing asscoiated", pricing });
} catch (error) {
  console.log(error);
  res.status(500).json({ message: 'Error getting Pricing', error });
}
});

router.put('/pricing', authenticate, async (req, res) => {
 try {
  const adminId = req.user.id;
  const { carid, costperhr } = req.body;

  const admin = await Admin.findByPk(adminId);
  if (!admin) {
    return res.status(404).json({ message: 'Admin not found' });
  }

  const pricing = await Pricing.findByPk(carid);
  if (!pricing) {
    return res.status(404).json({ message: 'Pricing record not found' });
  }

  pricing.costperhr = costperhr;
  await pricing.save();

  res.status(200).json({ message: 'Pricing updated successfully', pricing });
} catch (error) {
  console.log(error);
  res.status(500).json({ message: 'Error adding Pricing', error });
}
});

router.put('/auto-pricing', authenticate, async (req, res) => {
try{ 
  const adminId = req.user.id;
  const { carid } = req.body;

  const admin = await Admin.findByPk(adminId);
  if (!admin) {
    return res.status(404).json({ message: 'Admin not found' });
  }

  const pricing = await Pricing.findByPk(carid);
  if (!pricing) {
    return res.status(404).json({ message: 'Pricing record not found' });
  }
  const car = await Car.findOne({
    where: {
      carid: carid,
    }})
  if(!car){
    return res.status(404).json({ message: 'Car record not found' });
  }   
  const carAdditional = await CarAdditional.findOne({
    where: {
      carid: car.carid,
    }
  });
  const costperhr = await pricing1(car, carAdditional);
  console.log(costperhr);
  const Price = await Pricing.findOne({ where: { carid: car.carid } });
  var price;
  if (Price) {
    price = await Pricing.update(
      { costperhr: costperhr },
      {
        where: {
          carid: car.carid
        }
      }
    )
  }
  else {
    price = await Pricing.create({
      costperhr: costperhr,
      carid: car.carid
    })
  }
  res.status(200).json({ message: 'Pricing updated successfully',carid, costperhr });
} catch (error) {
  console.log(error);
  res.status(500).json({ message: 'Error adding Pricing', error });
}
});

router.post('/features', authenticate, async (req, res) => {
  try {
    const { featureName } = req.body;
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    let id = uuid.v4();
    const past_feature = await Feature.findOne({ where: { featureName: featureName } });
    if (past_feature) {
      return res.status(400).json({ message: 'Car feature already present' });
    }
    let feature = await Feature.create({
      id: id,
      featureName: featureName
    },
    );
    res.status(200).json({ message: 'Car feature added successfully', feature });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error adding features', error });
  }
});

router.get('/allfeatures', authenticate, async (req, res) => {
  try {
    const features = await Feature.findAll();
    res.status(200).json(features);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching features', error });
  }
});

router.delete('/features/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const feature = await Feature.findOne({ where: { id: id } });
    if (!feature) {
      return res.status(404).json({ message: 'Feature not found' });
    }
    await feature.destroy();
    res.status(200).json({ message: 'Feature deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting feature', error });
  }
});

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
    const { deviceid, carid } = req.body;
    const car = await Car.findOne({
      where: {
        carid: carid,
      }})
    if(!car){
      return res.status(400).json({ message: 'Car not found' });
    }  
    const mapping = await carDevices.findOne({
      where: {
        [Op.or]: [
          { carid: carid },
          { deviceid: deviceid }
        ]
      }
    });
    if(mapping)
    {
      return res.status(400).json({ message: 'Car or device id already mapped' });
    }  
    const newMapping = await carDevices.create({ deviceid, carid });

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

  const { deviceid, carid } = req.body;

  try {
    const mapping = await carDevices.findByPk(deviceid);

    if (!mapping) {
      return res.status(404).json({ message: 'Mapping not found' });
    }
    const car = await Car.findOne({
      where: {
        carid: carid,
      }})
    if(!car){
      return res.status(400).json({ message: 'Car not found' });
    } 

    mapping.carid = carid !== undefined ? carid : mapping.carid;

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
//Support
// View all support tickets
router.get('/support', authenticate, viewSupportTickets);

// Reply to a support ticket
router.post('/support/reply', authenticate, replyToSupportTicket);

// Escalate a support ticket
router.post('/support/escalate', authenticate, escalateSupportTicket);

// Resolve a support ticket
router.post('/support/resolve', resolveSupportTicket);

router.post('/support/supportChat', viewSupportChats);

router.post('/createBlog', authenticate, upload1.fields([{ name: 'blogImage_1', maxCount: 1 }, { name: 'blogImage_2', maxCount: 1 }]), createBlog);

router.post('/updateBlog', authenticate, upload1.fields([{ name: 'blogImage_1', maxCount: 1 }, { name: 'blogImage_2', maxCount: 1 }]), updateBlog);

router.get('/deleteBlog/:id', authenticate, deleteBlog);
router.get('/getAllBlogs', getAllBlogs);
router.get('/getBlogById/:id', getBlogById);
router.post('/send-notifications', authenticate, async (req, res) => {
  try {
      const { userIds, subject, message } = req.body;

      if (!userIds || userIds.length === 0) {
          return res.status(400).json({ message: 'No user IDs provided' });
      }

      const users = await UserAdditional.findAll({
          where: {
              id: userIds
          }
      });

      if (!users || users.length === 0) {
          return res.status(404).json({ message: 'Users not found' });
      }

      for (const user of users) {
          const email = user.Email; // Fetch email from UserAdditional
          if (email) {
              await sendEmail(email, subject, message);
          }
      }

      res.status(200).json({ message: 'Emails sent successfully' });
  } catch (error) {
      console.error('Error sending notifications:', error.message);
      res.status(500).json({ message: 'Error sending notifications', error });
  }
});

module.exports = router;
