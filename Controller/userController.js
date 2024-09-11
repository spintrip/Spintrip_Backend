//importing modules
const bcrypt = require("bcrypt");
const db = require("../Models");
const jwt = require("jsonwebtoken");
const axios = require('axios');
const Razorpay = require('razorpay');
const { User, Car, Chat, UserAdditional, Listing, sequelize, Booking, Pricing, CarAdditional,
  carFeature, Feedback, Host, Tax, Wishlist, Feature, Blog,
  Transaction } = require('../Models');
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
  return res.json({ message: 'OTP sent successfully', redirectTo: '/verify-otp' });
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
    const { carid } = req.body;
    const car = await Car.findOne({ where: { carid: carid } });
    if (!car) {
      return res.status(400).json({ message: 'Car is not available' });
    }
    const carFeatures = await carFeature.findAll({ where: { carid }, include: [Feature] });
    if (!carFeatures || carFeatures.length === 0) {
      return res.status(400).json({ message: 'No Car Feature Available' });
    }
    res.status(201).json({ message: 'Feature with Price', carFeatures });
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching car feature Details' });
  }
};
const cars = async (req, res) => {
  const cars = await Car.findAll();
  const pricingPromises = cars.map(async (car) => {
    const carAdditional = await CarAdditional.findOne({ where: { carid: car.carid, verification_status: '2' } });
    let availableCar;
    if (carAdditional) {
      availableCar = {
        carId: car.carid,
        carModel: car.carmodel,
        type: car.type,
        brand: car.brand,
        variant: car.variant,
        color: car.color,
        chassisNo: car.chassisno,
        mileage: car.mileage,
        registrationYear: car.Registrationyear,
        rcNumber: car.Rcnumber,
        bodyType: car.bodytype,
        hostId: car.hostId,
        rating: car.rating,
        carImage1: carAdditional.carimage1,
        carImage2: carAdditional.carimage2,
        carImage3: carAdditional.carimage3,
        carImage4: carAdditional.carimage4,
        carImage5: carAdditional.carimage5,
      }
      const cph = await Pricing.findOne({ where: { carid: car.carid } });
      if (cph) {
        const costperhr = cph.costperhr;
        return { ...availableCar, costPerHr: costperhr };
      }
      else {
        return { ...availableCar, costPerHr: null };
      }
    }
  });

  // Wait for all pricing calculations to complete
  const carsWithPricing = (await Promise.all(pricingPromises)).filter(cars => cars != null);
  res.status(200).json({ "message": "All available cars", cars: carsWithPricing })
};
const findcars = async (req, res) => {
  const { startDate, endDate, startTime, endTime, latitude, longitude } = req.body;
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
      include: [Car],
    });
    // Map over the listings to get cars with pricing
    const pricingPromises = availableListings.map(async (listing) => {
      // Extract carId from listing dataValues
      const carId = listing.dataValues.carid;

      // Fetch the Car data based on carId
      const car = await Car.findOne({ where: { carid: carId } });
      if (!car) {
        // Skip or handle the error appropriately if Car data is not found
        return null;
      }
      const carAdditional = await CarAdditional.findOne({ where: { carid: carId } });
      if (!carAdditional) {
        return null;
      }
      if (carAdditional.verification_status != 2) {
        return null;
      }
      const check_booking = await Booking.findOne({
        where: {
          carid: carId,
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
            }
          ]
        }
      });
      if (check_booking) {
        return null;
      }

      // Fetch the Pricing data for the Car
      const cph = await Pricing.findOne({ where: { carid: carId } });
      let availableCar = {
        carId: car.carid,
        carModel: car.carmodel,
        type: car.type,
        brand: car.brand,
        variant: car.variant,
        color: car.color,
        chassisNo: car.chassisno,
        rcNumber: car.Rcnumber,
        bodyType: car.bodytype,
        hostId: car.hostId,
        rating: car.rating,
        mileage: car.mileage,
        registrationYear: car.Registrationyear,
        horsePower: carAdditional.HorsePower,
        ac: carAdditional.AC,
        musicSystem: carAdditional.Musicsystem,
        autoWindow: carAdditional.Autowindow,
        sunRoof: carAdditional.Sunroof,
        touchScreen: carAdditional.Touchscreen,
        sevenSeater: carAdditional.Sevenseater,
        reverseCamera: carAdditional.Reversecamera,
        transmission: carAdditional.Transmission,
        airBags: carAdditional.Airbags,
        fuelType: carAdditional.FuelType,
        petFriendly: carAdditional.PetFriendly,
        powerSteering: carAdditional.PowerSteering,
        abs: carAdditional.ABS,
        tractionControl: carAdditional.tractionControl,
        fullBootSpace: carAdditional.fullBootSpace,
        keylessEntry: carAdditional.KeylessEntry,
        airPurifier: carAdditional.airPurifier,
        cruiseControl: carAdditional.cruiseControl,
        voiceControl: carAdditional.voiceControl,
        usbCharger: carAdditional.usbCharger,
        bluetooth: carAdditional.bluetooth,
        airFreshner: carAdditional.airFreshner,
        ventelatedFrontSeat: carAdditional.ventelatedFrontSeat,
        additionalInfo: carAdditional.Additionalinfo,
        latitude: carAdditional.latitude,
        longitude: carAdditional.longitude,
        carImage1: carAdditional.carimage1,
        carImage2: carAdditional.carimage2,
        carImage3: carAdditional.carimage3,
        carImage4: carAdditional.carimage4,
        carImage5: carAdditional.carimage5,


      }

      if (cph) {
        const hours = calculateTripHours(startDate, endDate, startTime, endTime);
        const amount = Math.round(cph.costperhr * hours);
        const costperhr = Math.round(cph.costperhr);
        // Combine the Car data with the pricing information
        return { ...availableCar, pricing: { costPerHr: costperhr, hours: hours, amount: amount } };
      } else {
        // Handle the case where Pricing data is not available
        return { ...availableCar, pricing: null };
      }
    });
    const carsWithPricing = (await Promise.all(pricingPromises)).filter(car => car !== null);
    if (latitude && longitude) {
      carsWithPricing.forEach(car => {
        car.distance = haversineDistance(latitude, longitude, car.latitude, car.longitude);
      });

      carsWithPricing.sort((a, b) => a.distance - b.distance);
    }
    res.status(200).json({ availableCars: carsWithPricing });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error finding available cars' });
  }
}

const onecar = async (req, res) => {
  const { carId, startDate, endDate, startTime, endTime, features } = req.body;
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
        carid: carId,
      },
      include: [Car],
    });
    if (availableListings) {
      // Extract car information from the listings
      const availableCars = await Car.findOne({
        where: {
          carid: availableListings.carid,
        }
      });
      const check_booking = await Booking.findOne({
        where: {
          carid: carId,
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
        return res.status(400).json({ message: 'Selected car is not available for the specified dates' });
      }
      // Calculate pricing for each available car
      const cph = await Pricing.findOne({ where: { carid: availableCars.carid } });
      let cars = {
        carId: availableCars.carid,
        carModel: availableCars.carmodel,
        type: availableCars.type,
        brand: availableCars.brand,
        variant: availableCars.variant,
        color: availableCars.color,
        chassisNo: availableCars.chassisno,
        rcNumber: availableCars.Rcnumber,
        bodyType: availableCars.bodytype,
        hostId: availableCars.hostId,
        rating: availableCars.rating,
        mileage: availableCars.mileage,
      }
      if (cph) {
        const hours = calculateTripHours(startDate, endDate, startTime, endTime);
        let amount = Math.round(cph.costperhr * hours);
        const costperhr = cph.costperhr;
        let featureCost = 0;
        if (features) {
          for (const feature of features) {
            const featureDetail = await carFeature.findOne({ where: { featureid: feature, carid: carId } });
            if (featureDetail) {
              featureCost += featureDetail.price;
            }
          }
        }

        amount += featureCost;
        // Include pricing information in the car object
        res.status(200).json({ cars, pricing: { costPerHr: costperhr, hours: hours, amount: amount } });
      } else {
        res.status(200).json({ cars, pricing: null });
      }
    }
    else {
      res.status(400).json({ message: 'Car is not available' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error finding available cars' });
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
    const host = await Car.findOne({
      where: { carid: booking.carid }
    })

    const userEmail = user?.Email;
    const hostId = host?.hostId;
    var hostEmail = await UserAdditional.findOne({
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
    const { carId, startDate, endDate, startTime, endTime, features } = req.body;
    const userId = req.user.userid;
    const userAdd = await UserAdditional.findOne({
      where: {
        id: userId,
      }
    });
    if (userAdd.verification_status != 2) {
      return res.status(400).json({ message: 'Your DL and Aadhar is not Approved' });
    }
    const listing = await Listing.findOne({
      where: {
        carid: carId,
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
    });
    if (listing) {
      const check_booking = await Booking.findOne({
        where: {
          carid: carId,
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
            }
          ]
        }
      });
      if (check_booking) {
        return res.status(400).json({ message: 'Selected car is not available for the specified dates' });
      }
    }
    else {
      return res.status(400).json({ message: 'Selected car is not available for the specified dates' });
    }
    try {
      let cph = await Pricing.findOne({ where: { carid: carId } })
      let hours = calculateTripHours(startDate, endDate, startTime, endTime);
      let amount = Math.round(cph.costperhr * hours);
      let featureCost = 0;
      if (features) {
        for (const feature of features) {
          const featureDetail = await carFeature.findOne({ where: { featureid: feature, carid: carId } });
          if (featureDetail) {
            featureCost += featureDetail.price;
          }
        }
      }
      amount += featureCost;
      const tax = await Tax.findOne({ where: { id: 1 } }); // Adjust the condition as necessary
      if (!tax) {
        return res.status(404).json({ message: 'Tax data not found' });
      }
      let spinTripGST = (amount * (tax.GST / 100) * (tax.Commission / 100)).toFixed(2);
      let hostGst = ((amount - (amount * tax.Commission / 100)) * (tax.HostGST / 100)).toFixed(2);
      const tdsRate = tax.TDS / 100;
      const HostCommision = 1 - (tax.Commission / 100);

      // Update booking amounts using dynamic tax rates
      let gstAmount = (parseFloat(spinTripGST) + parseFloat(hostGst)).toFixed(2);
      let insuranceAmount = (amount * tax.insurance) / 100;
      let totalUserAmount = (amount + parseFloat(gstAmount) + insuranceAmount).toFixed(2);
      let tds = ((amount * HostCommision) * tdsRate).toFixed(2);
      let totalHostAmount = ((amount * HostCommision) - parseFloat(tds)).toFixed(2);
      const bookingid = uuid.v4();
      let booking = await Booking.create({
        Bookingid: bookingid,
        carid: carId,
        startTripDate: startDate,
        endTripDate: endDate,
        startTripTime: startTime,
        endTripTime: endTime,
        id: userId,
        status: 5,
        amount: amount,
        GSTAmount: gstAmount,
        insurance: insuranceAmount,
        totalUserAmount: totalUserAmount,
        TDSAmount: tds,
        totalHostAmount: totalHostAmount,
        features: features
      });

      const bookings = {
        bookingId: booking.Bookingid,
        carId: booking.carid,
        id: booking.id,
        status: booking.status,
        amount: booking.amount,
        Transactionid: booking.Transactionid,
        startTripDate: booking.startTripDate,
        endTripDate: booking.endTripDate,
        startTripTime: booking.startTripTime,
        endTripTime: booking.endTripTime,
        gstAmount: booking.GSTAmount,
        insurance: booking.insurance,
        totalUserAmount: booking.totalUserAmount,
      }
      req.body.bookingId = booking.Bookingid;
      req.body.userId = userId;
      req.body.amount = amount;
      //const paymentUrl = await initiatePayment(req);
      //res.status(201).json({ message: 'Booking successful', booking, paymentUrl });
      const { userEmail, hostEmail, bookingDetails } = await getBookingDetails(bookings.bookingId);
      await sendBookingConfirmationEmail(userEmail, hostEmail, bookingDetails, "Booking successful");
      autoCancelBooking(booking.Bookingid);
      res.status(201).json({ message: 'Booking successful', bookings });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error processing booking' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}

const postwishlist = async (req, res) => {
  try {
    const { carId } = req.body;
    const userId = req.user.userid;
    console.log(carId);
    const car = await Car.findOne({
      where: {
        carid: carId,
      }
    });
    if (!car) {
      res.status(404).json({ message: 'Car not found' });
    }
    const wishlist = await Wishlist.findOne({
      where: {
        userid: userId,
        carid: carId,
      }
    });
    if (wishlist) {
      res.status(200).json({ message: 'Wishlist Already added' });
    }
    else {
      await Wishlist.create({
        userid: userId,
        carid: carId,
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
    const { carId } = req.body;
    const userId = req.user.userid;
    const car = await Car.findOne({
      where: {
        carid: carId,
      }
    });
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }
    const wishlist = await Wishlist.findOne({
      where: {
        userid: userId,
        carid: carId,
      }
    });
    if (!wishlist) {
      res.status(404).json({ message: 'Wishlist not present' });
    }
    else {
      await Wishlist.destroy({
        where: {
          userid: userId,
          carid: carId,
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
      const car = await Car.findOne({
        where: {
          carid: wishlists.carid,
        }
      });
      if (!car) {
        return;
      }
      console.log(car);
      const carAdditional = await CarAdditional.findOne({ where: { carid: wishlists.carid } });
      let wl;
      wl = {
        carId: wishlists.carid,
        carModel: car.carmodel,
        type: car.type,
        brand: car.brand,
        variant: car.variant,
        color: car.color,
        chassisNo: car.chassisno,
        mileage: car.mileage,
        registrationYear: car.Registrationyear,
        rcNumber: car.Rcnumber,
        bodyType: car.bodytype,
        rating: car.rating,
        horsePower: carAdditional.HorsePower,
        latitude: carAdditional.latitude,
        longitude: carAdditional.longitude,
        carImage1: carAdditional.carimage1,
        carImage2: carAdditional.carimage2,
        carImage3: carAdditional.carimage3,
        carImage4: carAdditional.carimage4,
        carImage5: carAdditional.carimage5,
      }
      const cph = await Pricing.findOne({ where: { carid: car.carid } });
      if (cph) {
        const costperhr = cph.costperhr;
        // Include pricing information in the car object
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
const getcaradditional = async (req, res) => {
  const { carId } = req.body;

  try {
    // Check if the host owns the car
    const car = await Car.findOne({ where: { carid: carId } });
    if (!car) {
      return res.status(404).json({ message: 'Car not found or unauthorized access' });
    }

    const carAdditional = await CarAdditional.findOne({ where: { carid: carId } });
    if (!carAdditional) {
      return res.status(404).json({ message: 'Car additional information not found' });
    }
    const features = await carFeature.findAll({ where: { carid: carId } });
    if (!carAdditional) {
      return res.status(404).json({ message: 'Car additional information not found' });
    }

    const featureList = await Feature.findAll();
    const featureMap = featureList.reduce((map, f) => (map[f.id] = f.featureName, map), {});

    const updatedFeatures = features.map(f => ({
      ...f.dataValues,
      featureName: featureMap[f.featureid]
    }));
    let carAdditionals = {
      carId: carAdditional.carid,
      horsePower: carAdditional.HorsePower,
      ac: carAdditional.AC,
      musicSystem: carAdditional.Musicsystem,
      autoWindow: carAdditional.Autowindow,
      sunroof: carAdditional.Sunroof,
      touchScreen: carAdditional.Touchscreen,
      sevenSeater: carAdditional.Sevenseater,
      reverseCamera: carAdditional.Reversecamera,
      transmission: carAdditional.Transmission,
      airBags: carAdditional.Airbags,
      fuelType: carAdditional.FuelType,
      petFriendly: carAdditional.PetFriendly,
      powerSteering: carAdditional.PowerSteering,
      abs: carAdditional.ABS,
      tractionControl: carAdditional.tractionControl,
      fullBootSpace: carAdditional.fullBootSpace,
      keylessEntry: carAdditional.KeylessEntry,
      airPurifier: carAdditional.airPurifier,
      cruiseControl: carAdditional.cruiseControl,
      voiceControl: carAdditional.voiceControl,
      usbCharger: carAdditional.usbCharger,
      bluetooth: carAdditional.bluetooth,
      airFreshner: carAdditional.airFreshner,
      ventelatedFrontSeat: carAdditional.ventelatedFrontSeat,
      carImage1: carAdditional.carimage1,
      carImage2: carAdditional.carimage2,
      carImage3: carAdditional.carimage3,
      carImage4: carAdditional.carimage4,
      carImage5: carAdditional.carimage5,
      verificationStatus: carAdditional.verification_status,
      latitude: carAdditional.latitude,
      longitude: carAdditional.longitude,
      registrationYear: car.Registrationyear
    }
    // Path to the car's folder in the uploads directory
    const carImages = [];
    if (carAdditional.carimage1) carImages.push(carAdditional.carimage1);
    if (carAdditional.carimage2) carImages.push(carAdditional.carimage2);
    if (carAdditional.carimage3) carImages.push(carAdditional.carimage3);
    if (carAdditional.carimage4) carImages.push(carAdditional.carimage4);
    if (carAdditional.carimage5) carImages.push(carAdditional.carimage5);
    if (carImages) {
      res.status(200).json({
        message: "Car Additional data",
        carAdditionals,
        carImages,
        updatedFeatures
      });
    }
    else {
      res.status(200).json({
        message: "Car Additional data, no image found",
        carAdditionals,
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

    // Check car availability
    const listing = await Listing.findOne({
      where: {
        carid: booking.carid,
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
      return res.status(400).json({ message: 'Car is not available' });
    }

    // Calculate additional hours and cost
    const additionalHours = calculateTripHours(currentEndDate, newEndDate, currentEndTime, newEndTime);
    const cph = await Pricing.findOne({ where: { carid: booking.carid } });
    if (!cph) {
      return res.status(400).json({ message: 'Car pricing is not available' });
    }
    const additionalAmount = Math.round(cph.costperhr * additionalHours);

    // Create a new booking for the extension
    const extensionBookingId = uuid.v4();
    const newBooking = await Booking.create({
      Bookingid: extensionBookingId,
      carid: booking.carid,
      startTripDate: currentEndDate, // Extension starts from the current end date
      endTripDate: newEndDate,
      startTripTime: currentEndTime,
      endTripTime: newEndTime,
      id: userId,
      status: 5, // Pending host approval
      amount: additionalAmount,
    });

    // Update or create the BookingExtension entry
    const bookingExtension = await BookingExtension.findOne({ where: { bookingId } });
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
    let { carId, startDate, endDate, startTime, endTime, features } = req.body;
    const cph = await Pricing.findOne({ where: { carid: carId } });
    const hours = calculateTripHours(startDate, endDate, startTime, endTime);
    if (!cph) {
      return res.status(404).json({ message: 'Pricing of the car not available' });
    }
    let amount = Math.round(cph.costperhr * hours);

    let featureCost = 0;
    if (features) {
      for (const feature of features) {
        const featureDetail = await carFeature.findOne({ where: { featureid: feature, carid: carId } });
        if (featureDetail) {
          featureCost += featureDetail.price;
        }
      }
    }

    amount += featureCost;
    const costperhr = cph.costperhr;
    const tax = await Tax.findOne({ where: { id: 1 } });
    if (!tax) {
      return res.status(404).json({ message: 'Tax data not found' });
    }
    let spinTripGST = amount * (tax.GST / 100) * (tax.Commission / 100);
    let insuranceAmount = (amount * tax.insurance) / 100;
    let hostGst = (amount - (amount * tax.Commission / 100)) * (tax.HostGST / 100);
    let gstAmount = spinTripGST + hostGst;
    let totalUserAmount = amount + gstAmount + insuranceAmount;

    return res.status(200).json({
      totalHours: hours,
      costPerHr: costperhr,
      baseAmount: amount,
      spinTripGST: spinTripGST,
      hostGst: hostGst,
      gstAmount: gstAmount,
      insurance: insuranceAmount,
      grossAmount: totalUserAmount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}
const mergeBooking = async (originalBookingId) => {
  try {
    // Fetch the booking extension details
    const bookingExtension = await BookingExtension.findOne({ where: { bookingId: originalBookingId } });

    if (bookingExtension) {
      // Iterate through each extended booking and merge it with the original booking
      for (const extendedBookingId of bookingExtension.extendedBookings) {
        const extendedBooking = await Booking.findOne({ where: { Bookingid: extendedBookingId, status: 5 } });

        if (extendedBooking) {
          // Update the original booking with the extended details
          await Booking.update(
            {
              endTripDate: extendedBooking.endTripDate,
              endTripTime: extendedBooking.endTripTime,
              amount: sequelize.literal(`amount + ${extendedBooking.amount}`),
              GSTAmount: sequelize.literal(`GSTAmount + ${extendedBooking.GSTAmount}`),
              totalUserAmount: sequelize.literal(`totalUserAmount + ${extendedBooking.totalUserAmount}`),
              tds: sequelize.literal(`tds + ${extendedBooking.tds}`),
              totalHostAmount: sequelize.literal(`totalHostAmount + ${extendedBooking.totalHostAmount}`),
            },
            { where: { Bookingid: originalBookingId } }
          );

          // Remove the extended booking after merging
          await Booking.destroy({ where: { Bookingid: extendedBookingId } });

          // Update the booking extension entry
          bookingExtension.extendedBookings = bookingExtension.extendedBookings.filter(
            (id) => id !== extendedBookingId
          );

          await bookingExtension.save();
        }
      }
    }

    // After merging, set the status of the current booking to 3
    await Booking.update(
      { status: 3 },
      { where: { Bookingid: originalBookingId } }
    );

  } catch (error) {
    console.error(`Error merging extended bookings for ${originalBookingId}:`, error);
    throw new Error('Failed to merge extended bookings.');
  }
};

const tripstart = async (req, res) => {
  try {
    const { bookingId } = req.body;

    // Fetch the booking and ensure it is pending trip start
    const booking = await Booking.findOne({
      where: { Bookingid: bookingId, status: 1 },
    });

    if (!booking) {
      return res.status(404).json({ message: 'Trip already started or not present' });
    }

    // Check if the booking is an extended booking
    const bookingExtension = await BookingExtension.findOne({ where: { bookingId } });

    if (bookingExtension) {
      // Call the merge function to handle the merging of bookings
      await mergeBooking(bookingId);
    } else {
      // For non-extended bookings, set status to 2 (active)
      await Booking.update(
        { status: 2 },
        { where: { Bookingid: bookingId } }
      );
    }

    // Update the car listing with the booking ID
    await Listing.update(
      { bookingId: bookingId },
      { where: { carid: booking.carid } }
    );

    // Send trip start email notifications
    const { userEmail, hostEmail, bookingDetails } = await getBookingDetails(bookingId);
    await sendTripStartEmail(userEmail, hostEmail, bookingDetails, "Trip has been started");

    res.status(201).json({ message: 'Trip has started' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const autoCancelBooking = async (bookingId) => {
  try {
    // Wait for 30 minutes (1800000 milliseconds)
    await setTimeout(1800000);
    // Fetch the booking again to check if it's still in the pending status
    const booking = await Booking.findOne({ where: { Bookingid: bookingId } });

    // If the booking is still pending approval (status 5), cancel it
    if (booking && booking.status === 5) {
      await Booking.update(
        { status: 4, cancelDate: new Date(), cancelReason: 'Auto-cancelled due to no approval from host within 30 minutes.' },
        { where: { Bookingid: bookingId } }
      );

      const { userEmail, hostEmail, bookingDetails } = await getBookingDetails(bookingId);
      await sendBookingCancellationEmail(userEmail, hostEmail, bookingDetails, 'Booking auto-cancelled due to no approval from host within 30 minutes.');

      console.log(`Booking ${bookingId} auto-cancelled after 30 minutes of no host approval.`);
    }
  } catch (error) {
    console.error(`Error in auto-cancelling booking ${bookingId}:`, error);
  }
};
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
        const { userEmail, hostEmail, bookingDetails } = getBookingDetails(booking.Bookingid);
        sendBookingCancellationEmail(userEmail, hostEmail, bookingDetails, 'The booking has been cancelled')
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
        const car = await Car.findOne({ where: { carid: booking.carid } });
        if (!car) {
          return null;
        }

        const carAdditional = await CarAdditional.findOne({ where: { carid: booking.carid } });
        const transaction = await Transaction.findOne({ where: { Transactionid: booking.Transactionid } });

        const featureDetails = (booking.features || []).map(featureId => ({
          featureId,
          featureName: featureMap[featureId] || 'Unknown Feature'
        }));

        return {
          bookingId: booking.Bookingid,
          carId: booking.carid,
          id: booking.id,
          status: booking.status,
          amount: booking.amount,
          gstAmount: booking.GSTAmount,
          insurance: booking.insurance,
          totalUserAmount: booking.totalUserAmount,
          transactionId: booking.Transactionid,
          transaction: transaction ? {
            transactionId: transaction.Transactionid,
            status: transaction.status,
          } : null,
          startTripDate: booking.startTripDate,
          endTripDate: booking.endTripDate,
          startTripTime: booking.startTripTime,
          endTripTime: booking.endTripTime,
          carModel: car.carmodel,
          hostId: car.hostId,
          carImage1: carAdditional.carimage1,
          carImage2: carAdditional.carimage2,
          carImage3: carAdditional.carimage3,
          carImage4: carAdditional.carimage4,
          carImage5: carAdditional.carimage5,
          latitude: carAdditional.latitude,
          longitude: carAdditional.longitude,
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
const bookingcompleted = async (req, res) => {
  try {
    const { bookingId } = req.body;
    // if (payment.status === 'captured') {
    const booking = await Booking.findOne({
      where: {
        Bookingid: bookingId,
        status: 2,
        //id: userId,
      }
    });
    if (booking) {
      const car = await Car.findOne({
        where: {
          carid: booking.carid,
        }
      });
      await Listing.update(
        { bookingId: null },
        { where: { carid: car.carid } }
      );
      await Booking.update(
        { status: 3 },
        { where: { Bookingid: bookingId } }
      );
      const { userEmail, hostEmail, bookingDetails } = await getBookingDetails(bookingId);
      await sendBookingConfirmationEmail(userEmail, hostEmail, bookingDetails, "Booking complete");
      return res.status(201).json({ message: 'booking complete', redirectTo: '/rating', bookingId });
    }
    else {
      return res.status(404).json({ message: 'Start the ride to Complete Booking' });
    }
    // }
    // else {
    // Payment not successful
    // return res.status(400).json({ message: 'Payment failed' });
    // }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}

const getfeedback = async (req, res) => {
  try {
    const { carId } = req.body;
    const feedback = await Feedback.findAll(
      { where: { carId: carId } }
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
      carId: feedback.carId,
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
    const pendingBookings = await Booking.findOne({
      where: {
        id: req.user.id,
        status: [1, 2, 5],
      },
    });

    if (pendingBookings) {
      return res.status(400).json({ message: 'Cannot delete account with pending bookings' });
    }
    await user.destroy();
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting user', error });
  }
}
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

    const car = await Car.findOne({
      where: {
        carid: booking.carid,
      }
    });
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    const bookingCount = await Booking.count({
      where: {
        carid: booking.carid,
        status: 3,
      }
    });

    let new_rating;
    if (bookingCount == 1) {
      new_rating = parseFloat(rating);
    } else {
      new_rating = (parseFloat(rating) + parseFloat(car.rating * (bookingCount - 1))) / bookingCount;
    }

    await car.update({ rating: new_rating });

    const car_ratings = await Car.sum('rating', {
      where: {
        hostId: car.hostId,
      }
    });

    if (feedback) {
      await Feedback.create({
        carId: car.carid,
        userId: userId,
        userName: user.FullName,
        hostId: car.hostId,
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
  rating
}