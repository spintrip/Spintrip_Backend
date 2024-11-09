//importing modules
const bcrypt = require("bcrypt");
const db = require("../Models");
const jwt = require("jsonwebtoken");
const axios = require('axios');
const Razorpay = require('razorpay');
const { User, Vehicle, Chat, UserAdditional, Listing, sequelize, Booking, Pricing,
  carFeature, Feedback, Host, Tax, Wishlist, Feature, Blog, Bike, Car, HostAdditional, VehicleAdditional, BookingExtension, Transaction } = require('../Models');
const express = require('express');
const uuid = require('uuid');
const { authenticate, generateToken } = require('../Middleware/authMiddleware');
const { getAllBlogs } = require('../Controller/blogController');
const { initiatePayment, checkPaymentStatus, phonePayment, webhook } = require('../Controller/paymentController');
const chatController = require('../Controller/chatController');
const { createSupportTicket, addSupportMessage, viewSupportChats, viewUserSupportTickets } = require('../Controller/supportController');
const { Op } = require('sequelize');
const multerS3 = require('multer-s3');
const s3 = require('../s3Config');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const csv = require('csv-parser');
const router = express.Router();
const { setTimeout } = require('timers/promises');
const { Sequelize } = require('sequelize');

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
const sendOTP = async (phone, otp) => {
  console.log(`Sending OTP ${otp} to phone number ${phone}`);
  const url = `https://2factor.in/API/V1/${process.env.SMS_API_KEY}/SMS/${phone}//${otp}/`;


  try {
    const response = await axios.get(url);
    console.log('OTP sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending OTP:', error);
  }
};
const generateOTP = () => {
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  return otp;
};
const resizeImage = async (buffer) => {
  let resizedBuffer = buffer;
  try {
    resizedBuffer = await sharp(buffer)
      .resize({ width: 1920, height: 1080, fit: 'inside' }) // Adjust the dimensions as needed
      .jpeg({ quality: 80 })
      .toBuffer();

    // Keep resizing until the buffer size is under 400KB
    while (resizedBuffer.length > 400 * 1024) {
      resizedBuffer = await sharp(resizedBuffer)
        .jpeg({ quality: 80 })
        .toBuffer();
    }
  } catch (error) {
    console.error('Error resizing image:', error);
  }
  return resizedBuffer;
};
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Radius of the Earth in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in km
}

const login = async (req, res) => {
  const { phone } = req.body;
  const user = await User.findOne({ where: { phone } });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  if (phone == '+911234567890') {
    return res.status(201).json({ message: 'OTP sent successfully', redirectTo: '/verify-otp', phone, otp: user.otp });
  }
  // Generate OTP
  const otp = generateOTP();
  // Send OTP to the user's phone
  sendOTP(phone, otp);
  await user.update({ otp: otp })
  // Redirect to verify OTP route
  return res.json({ message: 'OTP sent successfully', redirectTo: '/verify-otp', otp:otp });
};

//signing a user up
//hashing users password before its saved to the database with bcrypt
const signup = async (req, res) => {
  const { phone, password, role } = req.body;

  try {
    // Check if the provided role is valid
    if (!['user', 'host', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Hash the password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userId = uuid.v4();
    let user;
    // Create user based on the role
    if (role === 'user') {
      user = await User.create({ id: userId, phone, password: hashedPassword, role: 'user' });
    } else if (role === 'host') {
      user = await Host.create({ id: userId, phone, password: hashedPassword, role: 'host' });
    } else if (role === 'admin') {
      user = await Admin.create({ id: userId, phone, password: hashedPassword, role: 'admin' });
    }
    let response = {
      id: user.id,
      phone: user.phone,
      role: user.role,
    }

    UserAdditional.create({ id: user.id });
    // Respond with success message
    res.status(201).json({ message: 'User created', response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating user' });
  }
}

const razorpay = new Razorpay({
  key_id: 'RAZORPAY_KEY_ID',
  key_secret: 'RAZORPAY_KEY_SECRET',
});


async function createIndex(userId, files) {
  try {


    var doc = { id: userId, files: [] };
    files.forEach((file, index) => {
      doc[`fileName_${index}`] = file.filename;
      doc[`filePath_${index}`] = file.path;
    });

    solrClient.add(doc, function (err, solrResponse) {
      if (err) {
        console.error('Error adding document to Solr:', err);
        throw err;
      } else {
        solrClient.commit(); // Commit changes
        console.log(solrResponse)
      }
    });
  } catch (error) {
    console.error('Error in createIndex:', error);
    throw error; // Rethrow error for the caller to handle
  }
}

const verify = async (req, res) => {
  const { phone, otp } = req.body;
  const user = await User.findOne({ where: { phone } })
  if (!user) {
    return res.status(401).json({ message: 'Invalid OTP' });
  }
  const fixed_otp = user.otp;
  if (fixed_otp === otp) {
    const user = await User.findOne({ where: { phone } });
    const token = generateToken(user);
    const id = user.id;

    return res.json({ message: 'OTP verified successfully', id, token });
  } else {
    return res.status(401).json({ message: 'Invalid OTP' });
  }
}

const getprofile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const additionalInfo = await UserAdditional.findByPk(userId);

    if (!additionalInfo) {
      return res.status(404).json({ message: 'Additional user info not found' });
    }

    // Construct the URLs for the files stored in S3
    const aadharFile = additionalInfo.aadhar ? [additionalInfo.aadhar] : [];
    const dlFile = additionalInfo.dl ? [additionalInfo.dl] : [];
    const profilePic = additionalInfo.profilepic ? [additionalInfo.profilepic] : [];

    let profile = {
      id: additionalInfo.id,
      dlNumber: additionalInfo.Dlverification,
      fullName: additionalInfo.FullName,
      email: additionalInfo.Email,
      aadharNumber: additionalInfo.AadharVfid,
      address: additionalInfo.Address,
      verificationStatus: additionalInfo.verification_status,
      dl: dlFile,
      aadhar: aadharFile,
      profilePic: profilePic
    };

    res.json({
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      profile
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}
const putprofile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update additional user information
    const { dlNumber, fullName, aadharId, email, address, currentAddressVfId, mlData } = req.body;
    await UserAdditional.update({
      id: userId,
      Dlverification: dlNumber,
      FullName: fullName,
      AadharVfid: aadharId,
      Email: email,
      Address: address,
      CurrentAddressVfid: currentAddressVfId,
      ml_data: mlData
    }, { where: { id: userId } });

    res.status(200).json({ message: 'Profile Updated successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error updating profile', error: error });
  }
}

const getbrand = async (req, res) => {
  try {
    const brands = [];
    const csvFilePath = path.join(__dirname, '..', 'data', 'brands.csv');

    // Check if the file exists
    if (!fs.existsSync(csvFilePath)) {
      console.log(`File not found: ${csvFilePath}`);
      return res.status(404).json({ message: 'No brands found' });
    }
    console.log(`Reading file: ${csvFilePath}`);
    let brand;
    fs.createReadStream(csvFilePath)
      .pipe(csv({ headers: false }))
      .on('data', (row) => {
        if (row[1]) {
          brand = {
            brand_name: row[0],
            logo_path: row[1]
          };
        }
        else {
          brand = {
            brand_name: row[0],
            logo_path: null
          };

        }
        console.log(`Read row: ${JSON.stringify(brand)}`);
        brands.push(brand);
      })
      .on('end', () => {
        res.status(200).json({ brands });
      })
      .on('error', (error) => {
        console.error(`Error reading file: ${error}`);
        res.status(500).json({ message: 'Error reading CSV file', error });
      });
  } catch (error) {
    console.error(`Error in try-catch: ${error}`);
    res.status(500).json({ message: 'Error fetching brands', error });
  }
};
const features = async (req, res) => {

  try {
    const { vehicleid } = req.body;
    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid } });
    if (!vehicle) {
      return res.status(400).json({ message: 'vehicle is not available' });
    }
    const carFeatures = await carFeature.findAll({ where: { vehicleid }, include: [Feature] });
    if (!carFeatures || carFeatures.length === 0) {
      return res.status(400).json({ message: 'No vehicle Feature Available' });
    }
    res.status(201).json({ message: 'Feature with Price', carFeatures });
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching vehicle feature Details' });
  }
};

const findvehicles = async (req, res) => {
  const { vehicletype, startDate, endDate, startTime, endTime, latitude, longitude, distance  } = req.body;
  try {
    const availableListings = await Listing.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              {
                [Op.or]: [
                  {
                    pausetime_start_date: {
                      [Op.gt]: endDate,
                    },
                  },
                  {
                    pausetime_end_date: {
                      [Op.lt]: startDate,
                    },
                  },
                ],
              },
              {
                [Op.or]: [
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { pausetime_start_date: endDate },
                          { pausetime_start_date: null },
                        ],
                      },
                      {

                        [Op.or]: [
                          { pausetime_start_time: { [Op.gte]: endTime } },
                          { pausetime_start_time: null },
                        ],
                      },
                    ],
                  },
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { pausetime_end_date: startDate },
                          { pausetime_end_date: null },
                        ],
                      },
                      {
                        [Op.or]: [
                          { pausetime_end_time: { [Op.lte]: startTime } },
                          { pausetime_end_time: null },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            [Op.or]: [
              {
                [Op.and]: [
                  {
                    start_date: {
                      [Op.lt]: startDate,
                    },
                  },
                  {
                    end_date: {
                      [Op.gt]: endDate,
                    },
                  },
                ],
              },
              {
                [Op.or]: [
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { start_date: startDate },
                          { start_date: null },
                        ],
                      },
                      {

                        [Op.or]: [
                          { start_time: { [Op.lte]: startTime } },
                          { start_time: null },
                        ],
                      },
                    ],
                  },
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { end_date: endDate },
                          { end_date: null },
                        ],
                      },
                      {
                        [Op.or]: [
                          { end_time: { [Op.gte]: endTime } },
                          { end_time: null },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      include: [    {
        model: Vehicle,
        where: {
          vehicletype: vehicletype, // Add this filter for the vehicle type
        },
      },],
    });
    // Map over the listings to get cars with pricing
    const pricingPromises = availableListings.map(async (listing) => {
      // Extract vehicleid from listing dataValues
      const vehicleid = listing.dataValues.vehicleid;

      // Fetch the Car data based on vehicleid
      const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid } });
      if (!vehicle) {
        // Skip or handle the error appropriately if Car data is not found
        return null;
      }
      const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: vehicleid } });
      if (!vehicleAdditional) {
        return null;
      }
      // if (carAdditional.verification_status != 2) {
      //   return null;
      // }
      const check_booking = await Booking.findOne({
        where: {
          vehicleid: vehicleid,
          status: {
            [Op.in]: [1, 2, 5]  
          },
          [Op.or]: [
            // Case 1: The existing booking starts during the requested period
            {
              [Op.and]: [
                { startTripDate: { [Op.eq]: startDate } },
                { startTripTime: { [Op.between]: [startTime, endTime] } }
              ]
            },
            // Case 2: The existing booking ends during the requested period
            {
              [Op.and]: [
                { endTripDate: { [Op.eq]: endDate } },
                { endTripTime: { [Op.between]: [startTime, endTime] } }
              ]
            },
            // Case 3: The existing booking starts before the requested period and ends after it starts
            {
              [Op.and]: [
                { startTripDate: { [Op.lte]: startDate } },
                { endTripDate: { [Op.gte]: startDate } },
                {
                  [Op.or]: [
                    {
                      [Op.and]: [
                        { startTripDate: { [Op.eq]: startDate } },
                        { startTripTime: { [Op.lte]: startTime } }
                      ]
                    },
                    {
                      [Op.and]: [
                        { endTripDate: { [Op.eq]: startDate } },
                        { endTripTime: { [Op.gte]: startTime } }
                      ]
                    }
                  ]
                }
              ]
            },
            // Case 4: The requested period starts during an existing booking
            {
              [Op.and]: [
                { startTripDate: { [Op.lte]: endDate } },
                { endTripDate: { [Op.gte]: startDate } },
                {
                  [Op.or]: [
                    {
                      [Op.and]: [
                        { startTripDate: { [Op.eq]: endDate } },
                        { startTripTime: { [Op.lte]: endTime } }
                      ]
                    },
                    {
                      [Op.and]: [
                        { endTripDate: { [Op.eq]: startDate } },
                        { endTripTime: { [Op.gte]: startTime } }
                      ]
                    }
                  ]
                }
              ]
            },
            // Case 5: The existing booking completely overlaps the requested period
            {
              [Op.and]: [
                { startTripDate: { [Op.lte]: startDate } },
                { endTripDate: { [Op.gte]: endDate } },
                {
                  [Op.or]: [
                    {
                      [Op.and]: [
                        { startTripDate: { [Op.eq]: startDate } },
                        { startTripTime: { [Op.lte]: startTime } }
                      ]
                    },
                    {
                      [Op.and]: [
                        { endTripDate: { [Op.eq]: endDate } },
                        { endTripTime: { [Op.gte]: endTime } }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              [Op.and]: [
                { startTripDate: { [Op.lt]: startDate } },
                { endTripDate: { [Op.gt]: startDate } },
                { endTripDate: { [Op.lt]: endDate } }
              ]
            },
            {
              [Op.and]: [
                { startTripDate: { [Op.gte]: startDate } },
                { endTripDate: { [Op.lte]: endDate } },
              ],
            },
            {
              [Op.and]: [
                { startTripDate: { [Op.lt]: startDate } },
                { endTripDate: { [Op.gt]: endDate } }
              ]
            }
          ]
        }
      });
      if (check_booking) {
        return null;
      }

      let Additional;
      if( vehicle.vehicletype == 1 ){
         Additional = await Bike.findOne({ where: { vehicleid: vehicleid } });
         
      }
      if( vehicle.vehicletype == 2 ){
        Additional = await Car.findOne({ where: { vehicleid: vehicleid } });
      }

      
      // Fetch the Pricing data for the Car
      const cph = await Pricing.findOne({ where: { vehicleid: vehicleid } });
      let availableVehicle = {
        vehicleid: vehicle.vehicleid,
        chassisNo: vehicle.chassisno,
        rcNumber: vehicle.Rcnumber,
        hostId: vehicle.hostId,
        rating: vehicle.rating,
        registrationYear: vehicle.Registrationyear,
        additionalInfo: vehicleAdditional.Additionalinfo,
        latitude: vehicleAdditional.latitude,
        longitude: vehicleAdditional.longitude,
        vehicleImage1: vehicleAdditional.vehicleimage1,
        vehicleImage2: vehicleAdditional.vehicleimage2,
        vehicleImage3: vehicleAdditional.vehicleimage3,
        vehicleImage4: vehicleAdditional.vehicleimage4,
        vehicleImage5: vehicleAdditional.vehicleimage5,
      }

      if (cph) {
        const hours = calculateTripHours(startDate, endDate, startTime, endTime);
        const amount = Math.round(cph.costperhr * hours);
        const costperhr = Math.round(cph.costperhr);
        // Combine the Car data with the pricing information
        return { ...availableVehicle, pricing: { costPerHr: costperhr, hours: hours, amount: amount }, Additional };
      } else {
        // Handle the case where Pricing data is not available
        return { ...availableVehicle, pricing: null, Additional };
      }
    });
    let vehicleWithPricing = (await Promise.all(pricingPromises)).filter(vehicle => vehicle !== null);

    if (latitude && longitude) {
      vehicleWithPricing.forEach(vehicle => {
        vehicle.distance = haversineDistance(latitude, longitude, vehicle.latitude, vehicle.longitude);
      });
    
      vehicleWithPricing = vehicleWithPricing
        .filter(vehicle => vehicle.distance <= distance)
        .sort((a, b) => a.distance - b.distance);
    }
    res.status(200).json({ availableVehicles: vehicleWithPricing });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error finding available vehicles' });
  }
}

const onevehicle = async (req, res) => {
  const { vehicleid, startDate, endDate, startTime, endTime, features } = req.body;
  try {
    const availableListings = await Listing.findOne({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              {
                [Op.or]: [
                  {
                    pausetime_start_date: {
                      [Op.gt]: endDate,
                    },
                  },
                  {
                    pausetime_end_date: {
                      [Op.lt]: startDate,
                    },
                  },
                ],
              },
              {
                [Op.or]: [
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { pausetime_start_date: endDate },
                          { pausetime_start_date: null },
                        ],
                      },
                      {

                        [Op.or]: [
                          { pausetime_start_time: { [Op.gte]: endTime } },
                          { pausetime_start_time: null },
                        ],
                      },
                    ],
                  },
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { pausetime_end_date: startDate },
                          { pausetime_end_date: null },
                        ],
                      },
                      {
                        [Op.or]: [
                          { pausetime_end_time: { [Op.lte]: startTime } },
                          { pausetime_end_time: null },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            [Op.or]: [
              {
                [Op.and]: [
                  {
                    start_date: {
                      [Op.lt]: startDate,
                    },
                  },
                  {
                    end_date: {
                      [Op.gt]: endDate,
                    },
                  },
                ],
              },
              {
                [Op.or]: [
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { start_date: startDate },
                          { start_date: null },
                        ],
                      },
                      {

                        [Op.or]: [
                          { start_time: { [Op.lte]: startTime } },
                          { start_time: null },
                        ],
                      },
                    ],
                  },
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { end_date: endDate },
                          { end_date: null },
                        ],
                      },
                      {
                        [Op.or]: [
                          { end_time: { [Op.gte]: endTime } },
                          { end_time: null },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },

        ],
        vehicleid: vehicleid,
      },
      include: [Vehicle],
    });
    if (availableListings) {
      // Extract car information from the listings
      const availableVehicles = await Vehicle.findOne({
        where: {
          vehicleid: availableListings.vehicleid,
        }
      });
      const check_booking = await Booking.findOne({
        where: {
          vehicleid: vehicleid,
          status: {
            [Op.in]: [1, 2, 5]  // Assuming 1 and 2 are statuses for active bookings
          },
          [Op.or]: [
            // Case 1: The existing booking starts during the requested period
            {
              [Op.and]: [
                { startTripDate: { [Op.eq]: startDate } },
                { startTripTime: { [Op.between]: [startTime, endTime] } }
              ]
            },
            // Case 2: The existing booking ends during the requested period
            {
              [Op.and]: [
                { endTripDate: { [Op.eq]: endDate } },
                { endTripTime: { [Op.between]: [startTime, endTime] } }
              ]
            },
            // Case 3: The existing booking starts before the requested period and ends after it starts
            {
              [Op.and]: [
                { startTripDate: { [Op.lte]: startDate } },
                { endTripDate: { [Op.gte]: startDate } },
                {
                  [Op.or]: [
                    {
                      [Op.and]: [
                        { startTripDate: { [Op.eq]: startDate } },
                        { startTripTime: { [Op.lte]: startTime } }
                      ]
                    },
                    {
                      [Op.and]: [
                        { endTripDate: { [Op.eq]: startDate } },
                        { endTripTime: { [Op.gte]: startTime } }
                      ]
                    }
                  ]
                }
              ]
            },
            // Case 4: The requested period starts during an existing booking
            {
              [Op.and]: [
                { startTripDate: { [Op.lte]: endDate } },
                { endTripDate: { [Op.gte]: startDate } },
                {
                  [Op.or]: [
                    {
                      [Op.and]: [
                        { startTripDate: { [Op.eq]: endDate } },
                        { startTripTime: { [Op.lte]: endTime } }
                      ]
                    },
                    {
                      [Op.and]: [
                        { endTripDate: { [Op.eq]: startDate } },
                        { endTripTime: { [Op.gte]: startTime } }
                      ]
                    }
                  ]
                }
              ]
            },
            // Case 5: The existing booking completely overlaps the requested period
            {
              [Op.and]: [
                { startTripDate: { [Op.lte]: startDate } },
                { endTripDate: { [Op.gte]: endDate } },
                {
                  [Op.or]: [
                    {
                      [Op.and]: [
                        { startTripDate: { [Op.eq]: startDate } },
                        { startTripTime: { [Op.lte]: startTime } }
                      ]
                    },
                    {
                      [Op.and]: [
                        { endTripDate: { [Op.eq]: endDate } },
                        { endTripTime: { [Op.gte]: endTime } }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              [Op.and]: [
                { startTripDate: { [Op.lt]: startDate } },
                { endTripDate: { [Op.gt]: startDate } },
                { endTripDate: { [Op.lt]: endDate } }
              ]
            },
            {
              [Op.and]: [
                { startTripDate: { [Op.gte]: startDate } },
                { endTripDate: { [Op.lte]: endDate } },
              ],
            },
            {
              [Op.and]: [
                { startTripDate: { [Op.lt]: startDate } },
                { endTripDate: { [Op.gt]: endDate } }
              ]
            },
          ]
        }
      });
      if (check_booking) {
        return res.status(400).json({ message: 'Selected vehicle is not available for the specified dates' });
      }
      // Calculate pricing for each available car
      const cph = await Pricing.findOne({ where: { vehicleid: availableVehicles.vehicleid } });
      let vehicles = {
        vehicleid: availableVehicles.vehicleid,
        chassisNo: availableVehicles.chassisno,
        rcNumber: availableVehicles.Rcnumber,
        hostId: availableVehicles.hostId,
        rating: availableVehicles.rating,
      }
      let Additional;
      if( availableVehicles.vehicletype == 1 ){
         Additional = await Bike.findOne({ where: { vehicleid: vehicleid } });
         
      }
      if( availableVehicles.vehicletype == 2 ){
        Additional = await Car.findOne({ where: { vehicleid: vehicleid } });
      }
      if (cph) {
        const hours = calculateTripHours(startDate, endDate, startTime, endTime);
        let amount = Math.round(cph.costperhr * hours);
        const costperhr = cph.costperhr;
        let featureCost = 0;
        if (features) {
          for (const feature of features) {
            const featureDetail = await carFeature.findOne({ where: { featureid: feature, vehicleid: vehicleid } });
            if (featureDetail) {
              featureCost += featureDetail.price;
            }
          }
        }

        amount += featureCost;
        // Include pricing information in the car object
        res.status(200).json({ vehicles, Additional, pricing: { costPerHr: costperhr, hours: hours, amount: amount } });
      } else {
        res.status(200).json({ vehicles, Additional, pricing: null });
      }
    }
    else {
      res.status(400).json({ message: 'vehicle is not available' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error finding available vehicle' });
  }
}
function calculateTripHours(startTripDate, endTripDate, startTripTime, endTripTime) {
  // Combine date and time into a single string for both start and end
  const startDateTimeStr = `${startTripDate} ${startTripTime}`;
  const endDateTimeStr = `${endTripDate} ${endTripTime}`;

  // Parse the date and time strings into Date objects
  const startDateTime = new Date(startDateTimeStr);
  const endDateTime = new Date(endDateTimeStr);

  // Calculate the difference in milliseconds and then convert to hours
  const diffMilliseconds = endDateTime - startDateTime;
  const diffHours = diffMilliseconds / (1000 * 60 * 60);

  return diffHours;
}
const getBookingDetails = async (bookingId) => {
  try {
    const booking = await Booking.findOne({
      where: { Bookingid: bookingId }
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Fetch the host's user details using the hostId from the car model
    const user = await UserAdditional.findOne({
      where: { id: booking.id }
    });
    const host = await Vehicle.findOne({
      where: { vehicleid: booking.vehicleid }
    })

    const userEmail = user?.Email;
    const hostId = host?.hostId;
    var hostEmail = await HostAdditional.findOne({
      where: { id: hostId }
    });
    const bookingDetails = {
      carModel: host.carmodel,
      startDate: booking.startTripDate,
      startTime: booking.startTripTime,
      endDate: booking.endTripDate,
      endTime: booking.endTripTime,
    };
    hostEmail = hostEmail.Email;
    return { userEmail, hostEmail, bookingDetails };
  } catch (error) {
    console.error('Error in getBookingDetails:', error);
    throw error;
  }
};
const booking = async (req, res) => {
  try {
    const { vehicleid, startDate, endDate, startTime, endTime, features } = req.body;
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

    // Ensure the vehicle is not paused in the listing
    const listing = await Listing.findOne({
      where: {
        vehicleid: vehicleid,
        pausetime_start_date: null,
        pausetime_end_date: null
      }
    });

    if (!listing) {
      return res.status(400).json({ message: 'Selected vehicle is not available for the specified dates' });
    }

    // Calculate booking amount
    let cph = await Pricing.findOne({ where: { vehicleid: vehicleid } });
    let hours = calculateTripHours(startDate, endDate, startTime, endTime);
    let amount = Math.round(cph.costperhr * hours);
    let featureCost = 0;
    if (features) {
      for (const feature of features) {
        const featureDetail = await carFeature.findOne({ where: { featureid: feature, vehicleid: vehicleid } });
        if (featureDetail) {
          featureCost += featureDetail.price;
        }
      }
    }
    amount += featureCost;

    // Create booking
    const bookingid = uuid.v4();
    let booking = await Booking.create({
      Bookingid: bookingid,
      vehicleid: vehicleid,
      startTripDate: startDate,
      endTripDate: endDate,
      startTripTime: startTime,
      endTripTime: endTime,
      id: userId,
      status: 1,
      amount: amount,
      features: features
    });

    const bookings = {
      bookingId: booking.Bookingid,
      vehicleid: booking.vehicleid,
      id: booking.id,
      status: booking.status,
      amount: booking.amount,
      startTripDate: booking.startTripDate,
      endTripDate: booking.endTripDate,
      startTripTime: booking.startTripTime,
      endTripTime: booking.endTripTime,
    };

    const { userEmail, hostEmail, bookingDetails } = await getBookingDetails(bookings.bookingId);
    await sendBookingConfirmationEmail(userEmail, hostEmail, bookingDetails, "Booking successful");

    res.status(201).json({ message: 'Booking successful', bookings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error processing booking' });
  }
};
const postwishlist = async (req, res) => {
  try {
    const { vehicleid } = req.body;
    const userId = req.user.userid;
    console.log(vehicleid);
    const vehicle = await Vehicle.findOne({
      where: {
        vehicleid: vehicleid,
      }
    });
    if (!vehicle) {
      res.status(404).json({ message: 'Vehicle not found' });
    }
    const wishlist = await Wishlist.findOne({
      where: {
        userid: userId,
        vehicleid: vehicleid,
      }
    });
    if (wishlist) {
      res.status(200).json({ message: 'Wishlist Already added' });
    }
    else {
      await Wishlist.create({
        userid: userId,
        vehicleid: vehicleid,
      })
      res.status(201).json({ message: 'Wishlist Added successfully' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}
const cancelwishlist = async (req, res) => {
  try {
    const { vehicleid } = req.body;
    const userId = req.user.userid;
    const vehicle = await Vehicle.findOne({
      where: {
        vehicleid: vehicleid,
      }
    });
    if (!vehicle) {
      return res.status(404).json({ message: 'vehicle not found' });
    }
    const wishlist = await Wishlist.findOne({
      where: {
        userid: userId,
        vehicleid: vehicleid,
      }
    });
    if (!wishlist) {
      res.status(404).json({ message: 'Wishlist not present' });
    }
    else {
      await Wishlist.destroy({
        where: {
          userid: userId,
          vehicleid: vehicleid,
        }
      });
      res.status(200).json({ message: 'Wishlist removed successfully' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}
const getwishlist = async (req, res) => {
  try {
    const userId = req.user.userid;
    const wishlist = await Wishlist.findAll({ where: { userid: userId } })
    if (!wishlist) {
      res.status(200).json({ message: 'wishlist bucket is empty' });
    }
    console.log(wishlist);
    const userWishlist = wishlist.map(async (wishlists) => {
      const vehicle = await Vehicle.findOne({
        where: {
          vehicleid: wishlists.vehicleid,
        }
      });
      if (!vehicle) {
        return;
      }
      const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: wishlists.vehicleid } });
      let wl;
      wl = {
        vehicleid: wishlists.vehicleid,
        registrationYear: vehicle.Registrationyear,
        rcNumber: vehicle.Rcnumber,
        vehicleType: vehicle.vehicletype,
        rating: vehicle.rating,
        latitude: vehicleAdditional.latitude,
        longitude: vehicleAdditional.longitude,
        vehicleImage1: vehicleAdditional.vehicleimage1,
        vehicleImage2: vehicleAdditional.vehicleimage2,
        vehicleImage3: vehicleAdditional.vehicleimage3,
        vehicleImage4: vehicleAdditional.vehicleimage4,
        vehicleImage5: vehicleAdditional.vehicleimage5,
      }
      const cph = await Pricing.findOne({ where: { vehicleid: vehicle.vehicleid } });
      if (cph) {
        const costperhr = cph.costperhr;
        // Include pricing information in the vehicle object
        return { ...wl, costPerHr: costperhr };
      } else {
        return { ...wl, costPerHr: null };
      }
      return { ...wl };
    });
    const userWishlists = await Promise.all(userWishlist);
    res.status(201).json({ message: userWishlists });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}
const getvehicleadditional = async (req, res) => {
  const { vehicleid } = req.body;

  try {
    // Check if the host owns the vehicle
    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid } });
    if (!vehicle) {
      return res.status(404).json({ message: 'vehicle not found or unauthorized access' });
    }
    const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: vehicleid } });
    if (!vehicleAdditional) {
      return res.status(404).json({ message: 'vehicle additional information not found' });
    }
    let Additional, vehicleAdditionals;
    if( vehicle.vehicletype == 1 ){
       Additional = await Bike.findOne({ where: { vehicleid: vehicleid } });
       
    }
    if( vehicle.vehicletype == 2 ){
      Additional = await Car.findOne({ where: { vehicleid: vehicleid } });
    }
    const features = await carFeature.findAll({ where: { vehicleid: vehicleid } });  
    const featureList = await Feature.findAll();
    const featureMap = featureList.reduce((map, f) => (map[f.id] = f.featureName, map), {});
    
    const updatedFeatures = features.map(f => ({
      ...f.dataValues,
      featureName: featureMap[f.featureid]
    }));    


     vehicleAdditionals= {
      vehicleid: vehicle.vehicleid,
      vehicleImage1: vehicleAdditional.vehicleimage1,
      vehicleImage2: vehicleAdditional.vehicleimage2,
      vehicleImage3: vehicleAdditional.vehicleimage3,
      vehicleImage4: vehicleAdditional.vehicleimage4,
      vehicleImage5: vehicleAdditional.vehicleimage5,
      verificationStatus: vehicleAdditional.verification_status,
      latitude: vehicleAdditional.latitude,
      longitude: vehicleAdditional.longitude,
      rcNumber: vehicle.Rcnumber,
      registrationYear: vehicle.Registrationyear
    };
    const vehicleImages = [];
    if (vehicleAdditional.vehicleimage1) vehicleImages.push(vehicleAdditional.vehicleimage1);
    if (vehicleAdditional.vehicleimage2) vehicleImages.push(vehicleAdditional.vehicleimage2);
    if (vehicleAdditional.vehicleimage3) vehicleImages.push(vehicleAdditional.vehicleimage3);
    if (vehicleAdditional.vehicleimage4) vehicleImages.push(vehicleAdditional.vehicleimage4);
    if (vehicleAdditional.vehicleimage5) vehicleImages.push(vehicleAdditional.vehicleimage5);
    if (vehicleImages) {
      res.status(200).json({
        message: "vehicle Additional data",
        vehicleAdditionals,
        Additional,
        vehicleImages,
        updatedFeatures
      });
    }
    else {
      res.status(200).json({
        message: "vehicle Additional data, no image found",
        vehicleAdditionals,
        Additional,
        updatedFeatures
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}
const extend = async (req, res) => {
  try {
    const { bookingId, newEndDate, newEndTime } = req.body;
    const userId = req.user.userid;

    // Check if the original booking exists and is active
    const booking = await Booking.findOne({
      where: {
        Bookingid: bookingId,
        id: userId,
        status: 2,
      },
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found or not active' });
    }

    // Validate the new dates
    const currentEndDate = booking.endTripDate;
    const currentEndTime = booking.endTripTime;
    if (newEndDate < currentEndDate || (newEndDate === currentEndDate && newEndTime <= currentEndTime)) {
      return res.status(400).json({ message: 'New end date and time must be after the current end date and time' });
    }

    // Check for overlapping extensions
    const bookingExtension = await BookingExtension.findOne({ where: { bookingId } });
    if (bookingExtension) {
      const overlappingExtension = await Booking.findOne({
        where: {
          Bookingid: { [Op.in]: bookingExtension.extendedBookings },
          [Op.or]: [
            {
              startTripDate: { [Op.lte]: newEndDate },
              endTripDate: { [Op.gte]: booking.startTripDate },
              startTripTime: { [Op.lt]: newEndTime },
              endTripTime: { [Op.gt]: booking.startTripTime },
            },
          ],
        },
      });

      if (overlappingExtension) {
        return res.status(400).json({ message: 'Extension dates overlap with existing extensions' });
      }
    }

    // Check car availability
    const listing = await Listing.findOne({
      where: {
        vehicleid: booking.vehicleid,
        [Op.and]: [
          {
            [Op.or]: [
              {
                [Op.or]: [
                  {
                    pausetime_start_date: {
                      [Op.gt]: newEndDate,
                    },
                  },
                  {
                    pausetime_end_date: {
                      [Op.lt]: booking.startTripDate,
                    },
                  },
                ],
              },
              {
                [Op.or]: [
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { pausetime_start_date: newEndDate },
                          { pausetime_start_date: null },
                        ],
                      },
                      {
                        [Op.or]: [
                          { pausetime_start_time: { [Op.gte]: newEndTime } },
                          { pausetime_start_time: null },
                        ],
                      },
                    ],
                  },
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { pausetime_end_date: booking.startTripDate },
                          { pausetime_end_date: null },
                        ],
                      },
                      {
                        [Op.or]: [
                          { pausetime_end_time: { [Op.lte]: booking.startTripTime } },
                          { pausetime_end_time: null },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            [Op.or]: [
              {
                [Op.and]: [
                  {
                    start_date: {
                      [Op.lt]: booking.startTripDate,
                    },
                  },
                  {
                    end_date: {
                      [Op.gt]: newEndDate,
                    },
                  },
                ],
              },
              {
                [Op.or]: [
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { start_date: booking.startTripDate },
                          { start_date: null },
                        ],
                      },
                      {
                        [Op.or]: [
                          { start_time: { [Op.lte]: booking.startTripTime } },
                          { start_time: null },
                        ],
                      },
                    ],
                  },
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { end_date: newEndDate },
                          { end_date: null },
                        ],
                      },
                      {
                        [Op.or]: [
                          { end_time: { [Op.gte]: newEndTime } },
                          { end_time: null },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    if (!listing) {
      return res.status(400).json({ message: 'vehicle is not available' });
    }

    // Create the extended booking if all checks pass
    const additionalHours = calculateTripHours(currentEndDate, newEndDate, currentEndTime, newEndTime);
    const cph = await Pricing.findOne({ where: { vehicleid: booking.vehicleid } });
    let additionalAmount = Math.round(cph.costperhr * additionalHours);
    additionalAmount += 20 * (additionalAmount)/ 100;
    const tax = await Tax.findOne({ where: { id: 1 } });
    if (!tax) {
      return res.status(404).json({ message: 'Tax data not found' });
    }
    let spinTripGST = additionalAmount * (tax.GST / 100) * (tax.Commission / 100);
    let hostGst = (additionalAmount - (additionalAmount * tax.Commission / 100)) * (tax.HostGST / 100);
    let gstAmount = spinTripGST + hostGst;
    let insuranceAmount = (additionalAmount * tax.insurance) / 100;
    const tdsRate = tax.TDS / 100;
    const hostCommission = 1 - (tax.Commission / 100);
    let tds = ((additionalAmount * hostCommission) * tdsRate).toFixed(2);
    let totalUserAmount = additionalAmount + gstAmount + insuranceAmount;
    let totalHostAmount = ((additionalAmount * hostCommission) - parseFloat(tds)).toFixed(2);
    const newBooking = await Booking.create({
      Bookingid: uuid.v4(),
      vehicleid: booking.vehicleid,
      startTripDate: booking.startTripDate,
      endTripDate: newEndDate,
      startTripTime: booking.startTripTime,
      endTripTime: newEndTime,
      id: userId,
      status: 1,
      amount: additionalAmount,
      GSTAmount: gstAmount,
      insurance: insuranceAmount,
      totalUserAmount: totalUserAmount,
      totalHostAmount: totalHostAmount,
      TDSAmount: tds,
    });

    if (bookingExtension) {
      bookingExtension.extendedBookings.push(newBooking.Bookingid);
      await bookingExtension.save();
    } else {
      await BookingExtension.create({
        bookingId,
        extendedBookings: [newBooking.Bookingid],
      });
    }

    res.status(200).json({ message: 'Booking extension requested successfully', newBooking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error processing extend booking request' });
  }
};


const breakup = async (req, res) => {
  try {
    let { vehicleid, startDate, endDate, startTime, endTime, features } = req.body;
    const cph = await Pricing.findOne({ where: { vehicleid: vehicleid } });
    const hours = calculateTripHours(startDate, endDate, startTime, endTime);
    if (!cph) {
      return res.status(404).json({ message: 'Pricing of the vehicle not available' });
    }
    let amount = Math.round(cph.costperhr * hours);

    let featureCost = 0;
    if (features) {
      for (const feature of features) {
        const featureDetail = await carFeature.findOne({ where: { featureid: feature, vehicleid: vehicleid } });
        if (featureDetail) {
          featureCost += featureDetail.price;
        }
      }
    }

    amount += featureCost;
    const costperhr = cph.costperhr;
    return res.status(200).json({
      totalHours: hours,
      costPerHr: costperhr,
      baseAmount: amount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}

const cancelbooking = async (req, res) => {
  try {
    const { bookingId, CancelReason } = req.body;
    const booking = await Booking.findOne(
      { where: { Bookingid: bookingId } }
    );
    if (booking) {
      if (booking.status === 1 || booking.status === 5) {
        const today = new Date();
        const cancelDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        await Booking.update(
          {
            status: 4,
            cancelDate: cancelDate,
            cancelReason: CancelReason
          },
          { where: { Bookingid: bookingId } }
        );
        const { userEmail, hostEmail, bookingDetails } = await getBookingDetails(booking.Bookingid);
        sendBookingCancellationEmail(userEmail, hostEmail, bookingDetails, 'The booking has been cancelled by user')
        res.status(201).json({ message: 'Trip Has been Cancelled' });
      }
      else {
        res.status(404).json({ message: 'Ride Already Started' });
      }
    }
    else {
      res.status(404).json({ message: 'Booking Not found' });
    }
  }
  catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}
const userbookings = async (req, res) => {
  try {
    let userId = req.user.userid;
    const bookings = await Booking.findAll({ where: { id: userId } });

    if (bookings && bookings.length > 0) {
      const featureList = await Feature.findAll();
      const featureMap = featureList.reduce((map, feature) => {
        map[feature.id] = feature.featureName;
        return map;
      }, {});

      const userBookingPromises = bookings.map(async (booking) => {
        const vehicle = await Vehicle.findOne({ where: { vehicleid: booking.vehicleid } });
        if (!vehicle) {
          return null;
        }

        const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: booking.vehicleid } });
        const transaction = await Transaction.findOne({ where: { Transactionid: booking.Transactionid } });

        const featureDetails = (booking.features || []).map(featureId => ({
          featureId,
          featureName: featureMap[featureId] || 'Unknown Feature'
        }));

        return {
          bookingId: booking.Bookingid,
          vehicleid: booking.vehicleid,
          id: booking.id,
          status: booking.status,
          amount: booking.amount,
          startTripDate: booking.startTripDate,
          endTripDate: booking.endTripDate,
          startTripTime: booking.startTripTime,
          endTripTime: booking.endTripTime,
          hostId: vehicle.hostId,
          vehicleImage1: vehicleAdditional.vehicleimage1,
          vehicleImage2: vehicleAdditional.vehicleimage2,
          vehicleImage3: vehicleAdditional.vehicleimage3,
          vehicleImage4: vehicleAdditional.vehicleimage4,
          vehicleImage5: vehicleAdditional.vehicleimage5,
          latitude: vehicleAdditional.latitude,
          longitude: vehicleAdditional.longitude,
          cancelDate: booking.cancelDate,
          cancelReason: booking.cancelReason,
          features: featureDetails,
          createdAt: booking.createdAt,
        };
      });

      const userBookings = (await Promise.all(userBookingPromises)).filter(booking => booking !== null);
      res.status(201).json({ message: userBookings });
    } else {
      res.status(404).json({ message: 'Booking Not found' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

const getfeedback = async (req, res) => {
  try {
    const { vehicleid } = req.body;
    const feedback = await Feedback.findAll(
      { where: { vehicleid: vehicleid } }
    );
    if (feedback) {
      res.status(201).json({ message: feedback });
    }
    else {
      res.status(404).json({ message: 'No Feedback present' });
    }
  }
  catch (err) {
    res.status(500).json({ message: 'Server error' });
  }

}
const transactions = async (req, res) => {
  try {
    const userId = req.user.id;
    let transactions = []; // Initialize transactions as an array
    const bookings = await Booking.findAll({ where: { id: userId } });
    console.log(bookings);

    for (let i = 0; i < bookings.length; i++) {
      const bookingTransactions = await Transaction.findAll({ where: { Bookingid: bookings[i].Bookingid } });
      transactions = transactions.concat(bookingTransactions); // Concatenate the transactions
    }

    console.log(transactions);

    res.status(200).json({ message: 'Transactions for the user', transactions: transactions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}
const chat = async (req, res) => {
  const { hostId, message } = req.body;
  const userId = req.user.id;
  let imagePath = null;

  if (req.file) {
    imagePath = `http://localhost:5000/uploads/${userId}/${req.file.filename}`;
  }

  try {
    const chat = await Chat.create({
      userId,
      hostId,
      message,
      imagePath,
    });

    res.status(201).json({ message: 'Chat message sent', chat });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error sending chat message' });
  }
}
const chathistory = async (req, res) => {
  const { hostId } = req.query;
  const userId = req.user.id;

  try {
    const chats = await Chat.findAll({
      where: { userId, hostId },
      order: [['timestamp', 'ASC']],
    });

    res.status(200).json({ chats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching chat history' });
  }
}
const toprating = async (req, res) => {
  try {
    const topRatings = await Feedback.findAll({
      where: {
        rating: 5
      }
    });

    if (!topRatings || topRatings.length === 0) {
      return res.status(404).json({ message: 'No 5-star ratings found' });
    }

    const feedbackList = topRatings.map(feedback => ({
      vehicleid: feedback.vehicleid,
      userId: feedback.userId,
      userName: feedback.userName,
      hostId: feedback.hostId,
      rating: feedback.rating,
      comment: feedback.comment,
      createdAt: feedback.createdAt
    }));

    res.status(200).json({ message: 'Top 5-star ratings', feedback: feedbackList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}
const deleteuser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.destroy();
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting user', error });
  }
};
const rating = async (req, res) => {
  try {
    let { bookingId, rating, feedback } = req.body;
    if (!rating) {
      rating = 5;
    }
    const userId = req.user.id;
    const user = await UserAdditional.findOne({
      where: {
        id: userId,
      }
    });

    const booking = await Booking.findOne({
      where: {
        Bookingid: bookingId,
      }
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const vehicle = await Vehicle.findOne({
      where: {
        vehicleid: booking.vehicleid,
      }
    });
    if (!vehicle) {
      return res.status(404).json({ message: 'vehicle not found' });
    }

    const bookingCount = await Booking.count({
      where: {
        vehicleid: booking.vehicleid,
        status: 3,
      }
    });

    let new_rating;
    if (bookingCount == 1) {
      new_rating = parseFloat(rating);
    } else {
      new_rating = (parseFloat(rating) + parseFloat(vehicle.rating * (bookingCount - 1))) / bookingCount;
    }

    await vehicle.update({ rating: new_rating });

    const vehicle_ratings = await vehicle.sum('rating', {
      where: {
        hostId: vehicle.hostId,
      }
    });

    if (feedback) {
      await Feedback.create({
        vehicleid: vehicle.vehicleid,
        userId: userId,
        userName: user.FullName,
        hostId: vehicle.hostId,
        rating: rating,
        comment: feedback
      });
      res.status(200).json({ message: 'Thank you for your response with feedback' });
    } else {
      // This block handles the case where there is no feedback
      res.status(200).json({ message: 'Thank you for your response' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}
module.exports = {
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
 // autoCancelBooking,
  cancelbooking,
  userbookings,
  getfeedback,
  transactions,
  chat,
  chathistory,
  toprating,
  deleteuser,
  rating
}