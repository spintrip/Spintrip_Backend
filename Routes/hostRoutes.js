const express = require('express');
const bcrypt = require('bcrypt');
const axios = require('axios');
const uuid = require('uuid');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../Middleware/authMiddleware');
const { Sequelize, Op } = require('sequelize');
const { fn, col, sum, count } = require('sequelize');
const { Host, Car, User, Listing, HostAdditional, UserAdditional, Booking, Pricing, Brand, Feedback, carFeature, Feature, Blog, carDevices, Device, Transaction, Vehicle, Bike, VehicleAdditional } = require('../Models');
const { and, TIME } = require('sequelize');
const { sendOTP, generateOTP, tripstart, bookingcompleted } = require('../Controller/hostController');
const { getAllBlogs } = require('../Controller/blogController');
const { setTimeout } = require('timers/promises');
const { Payout } = require('../Models');

const { 
  sendBookingConfirmationEmail, 
  sendBookingApprovalEmail, 
  sendTripStartEmail, 
  sendTripEndEmail, 
  sendPaymentConfirmationEmail,
  sendBookingCancellationEmail,
  sendBookingCompletionEmail
} = require('../Controller/emailController');
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../s3Config');
const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const fs = require('fs');
const path = require('path');
const { parseString } = require('xml2js');
const sharp = require('sharp');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const router = express.Router();
const chatController = require('../Controller/chatController');
const { createSupportTicket, addSupportMessage, viewSupportChats, viewUserSupportTickets } = require('../Controller/supportController');
const csv = require('csv-parser');

const vehicleImageStorage = multerS3({
  s3: s3,
  bucket: 'spintrip-bucket',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const vehicleid = req.body.vehicleid;
    const imageNumber = file.fieldname.split('_')[1];
    const fileName = `vehicleImage_${imageNumber}${path.extname(file.originalname)}`;
    cb(null, `vehicleAdditional/${vehicleid}/${fileName}`);
  }
});
const uploadvehicleImages = multer({ storage: vehicleImageStorage }).fields(
  Array.from({ length: 5 }, (_, i) => ({ name: `vehicleImage_${i + 1}` }))
);
const profileImageStorage = multerS3({
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

async function deleteFromS3(key) {
  try {
    const params = {
      Bucket: 'spintrip-bucket',
      Key: key,
    };

    await s3.send(new DeleteObjectCommand(params));
    console.log(`Successfully deleted ${key}`);
  } catch (error) {
    console.error(`Error deleting ${key}`, error);
  }
}
async function resizeImage(filePath) {
  try {
    await sharp(filePath)
      .resize(800, 600) // Example dimensions
      .toFile(`${filePath}-resized.jpg`);
    fs.unlinkSync(filePath); // Remove the original file
    fs.renameSync(`${filePath}-resized.jpg`, filePath); // Rename resized file to original file name
  } catch (error) {
    console.error('Error resizing image:', error);
  }
}

const upload = multer({ storage: profileImageStorage });

// Host Login
router.post('/login', authenticate, async (req, res) => {
  const { phone, password } = req.body;
  try {
    const user = await User.findOne({ where: { phone } });
    const host = await Host.findOne({ where: { id: user.id } });

    if (!host) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }
    if (phone == '+910123456789') {
      return res.status(201).json({ message: 'OTP sent successfully', redirectTo: '/verify-otp', phone, otp: user.otp });
    }
    const otp = generateOTP();
    sendOTP(phone, otp);
    await user.update({ otp: otp })
    return res.json({ message: 'OTP sent successfully', redirectTo: '/verify-otp', otp: otp });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

//Verify-Otp
router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  const user = await User.findOne({ where: { phone } })
  if (!user) {
    return res.status(401).json({ message: 'Invalid Phone' });
  }
  const fixed_otp = user.otp;
  if (fixed_otp === otp) {
    const user = await User.findOne({ where: { phone } });
    const token = jwt.sign({ id: user.id, role: 'host' }, 'your_secret_key');
    return res.json({ message: 'OTP verified successfully', id: user.id, token });
  } else {
    return res.status(401).json({ message: 'Invalid OTP' });
  }
});

router.get('/get-brand', async (req, res) => {
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
            logo_path:  row[1]
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
});

// Host Signup
router.post('/signup', async (req, res) => {
  var phone = req.body.phone;
  var password = req.body.password;
  try {
    const bcrypt = require("bcrypt");
    const salt = bcrypt.genSaltSync(10);
    // const hashedPassword = bcrypt.hashSync("my-password", salt);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userId = uuid.v4();
    const user = await User.create({ id: userId, phone, password: hashedPassword, role: 'Host' });
    const host = await Host.create({
      id: user.id,
    });
    HostAdditional.create({ id: user.id });
    let response = {
      id: user.id,
      phone: user.phone,
      role: user.role,
    }
    res.status(201).json({ message: 'Host created', response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating host' });
  }
});
// Host Profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const hostId = req.user.id;
    const host = await Host.findByPk(hostId);
    if (!host) {
      return res.status(404).json({ message: 'Host not found' });
    }
    const user = await User.findOne({ where: { id: hostId } });
    const vehicle = await Vehicle.findAll({ where: { hostId: host.id } })
    let additionalInfo = await HostAdditional.findByPk(hostId);
    let profile = {
      id: additionalInfo.id,
      GSTnumber: additionalInfo.GSTnumber,
      PANnumber: additionalInfo.PANnumber,
      FullName: additionalInfo.FullName,
      email: additionalInfo.Email,
      aadharNumber: additionalInfo.AadharVfid,
      address: additionalInfo.Address,
      verificationStatus: additionalInfo.verification_status,
      phone: user.phone,
      profilePic: additionalInfo.profilepic,   
      businessName: additionalInfo.businessName,
    }


    // You can include more fields as per your User model
    res.json({ hostDetails: host, vehicle, profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});
// Add Car
router.put('/verify', authenticate, upload.fields([{ name: 'profilePic', maxCount: 1 }]), async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let files = [];
    if (req.files) {
      if (req.files['profilePic']) files.push(req.files['profilePic'][0]);
    }
    const { profilePic } = req.files;
    console.log(profilePic);
    if (profilePic) {
      await HostAdditional.update({
        profilepic: profilePic ? profilePic[0].location : null,
      }, { where: { id: userId } });
    }

    res.status(200).json({ message: 'Profile Updated successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error updating profile', error: error });
  }
});

router.get('/payouts', authenticate, async (req, res) => {
  try {
    const hostId = req.user.id;

    // Find all payouts related to the host's userId
    const payouts = await Payout.findAll({
      where: { userId: hostId },
    });

    if (!payouts.length) {
      return res.status(404).json({ message: 'No payouts found for this host' });
    }

    // Calculate total amount for each payout
    const payoutsWithTotalAmount = await Promise.all(
      payouts.map(async (payout) => {
        // Assuming payout has a field 'bookingIds' that is an array of booking IDs
        const bookings = await Booking.findAll({
          where: {
            Bookingid: payout.bookingIds, // replace 'bookingIds' with the correct field name
          },
        });

        // Calculate the sum of totalHostAmount for the bookings
        const totalAmount = bookings.reduce((sum, booking) => {
          return sum + (booking.totalHostAmount || 0); // Safely handle null or undefined values
        }, 0);

        // Add totalAmount to the payout object
        return {
          ...payout.toJSON(), // Convert sequelize instance to plain object
          totalAmount,
        };
      })
    );

    res.status(200).json({ payouts: payoutsWithTotalAmount });
  } catch (error) {
    console.error('Error fetching payouts:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/vehicle', authenticate, async (req, res) => {
  const {
    vehicleModel,
    vehicletype,
    type,
    brand,
    variant,
    color,
    bodyType,
    chassisNo,
    rcNumber,
    engineNumber,
    registrationYear,
    city,
    latitude,
    longitude,
    address,
    timeStamp
  } = req.body;

  try {
    const host = await Host.findByPk(req.user.id);
    const vehiclehostid = req.user.id;

    if (!host) {
      return res.status(401).json({ message: 'No Host found' });
    }
    const vehicleid = uuid.v4();

    const vehicle = await Vehicle.create({
      vehicletype: vehicletype,
      chassisno: chassisNo,
      Rcnumber: rcNumber,
      Enginenumber: engineNumber,
      Registrationyear: registrationYear,
      vehicleid: vehicleid,
      hostId: vehiclehostid,
      timestamp: timeStamp,
      activated: false // Add activated field
    });

    await VehicleAdditional.create({
      vehicleid: vehicle.vehicleid,
      latitude: latitude,
      longitude: longitude,
      address: address,
    });

    if (vehicletype == '1') {
      await Bike.create({
        vehicleid: vehicleid,
        bikemodel: vehicleModel,
        type: type,
        brand: brand,
        variant: variant,
        color: color,
        bodytype: bodyType,
        city: city
      });
    }
    if (vehicletype == 2) {
      await Car.create({
        vehicleid: vehicleid,
        carmodel: vehicleModel,
        type: type,
        brand: brand,
        variant: variant,
        color: color,
        bodytype: bodyType,
        city: city
      });
    }

    await Pricing.create({
      vehicleid: vehicle.vehicleid
    });

    const listingid = uuid.v4();
    const listing = await Listing.create({
      id: listingid,
      vehicleid: vehicle.vehicleid,
      hostid: vehiclehostid,
    });

    let postedVehicle = {
      vehicleid: vehicle.vehicleid,
      vehicletype: vehicle.vehicletype,
      type: vehicle.type,
      chassisNo: vehicle.chassisno,
      engineNumber: vehicle.Enginenumber,
      rcNumber: vehicle.Rcnumber,
      hostId: vehicle.hostId,
      rating: vehicle.rating,
      listingId: listing.id,
    };
    res.status(201).json({ message: 'Vehicle and listing added successfully for the host', postedVehicle });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error Adding Vehicle' });
  }
});

//chat
router.post('/chat/send', chatController.sendMessage);
router.get('/chat/:bookingId', chatController.getMessagesByBookingId);

router.get('/delete_host', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Host not found' });
    }
    const host = await Host.findByPk(req.user.id);
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

router.post('/createListing', authenticate, async (req, res) => {
  const { vehicleid } = req.body;
  try {
    const host = await Host.findByPk(req.user.id);
    const vehiclehostid = req.user.id;

    if (!host) {
      return res.status(401).json({ message: 'No Host found' });
    }
    const listingid = uuid.v4();
    const listings = await Listing.create({
      id: listingid,
      vehicleid: vehicleid,
      hostid: vehiclehostid,
    });

    const listing = {
      id: listings.id,
      vehicleid: listings.vehicleid,
      hostId: listings.hostid,
      details: listings.details,
      startDate: listings.start_date,
      startTime: listings.start_time,
      endDate: listings.end_date,
      endTime: listings.end_time,
      pauseTimeStartDate: listings.pausetime_start_date,
      pauseTimeEndDate: listings.pausetime_end_date,
      pauseTimeStartTime: listings.pausetime_start_time,
      pauseTimeEndTime: listings.pausetime_end_time,
      bookingId: listings.bookingId
    }
    res.status(200).json({ message: 'Listing created successfully', listing });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error Adding Listing' });
  }
});

router.put('/vehicleAdditional', authenticate, uploadvehicleImages, async (req, res) => {
  try {
    const {
      vehicleid,
      horsePower,
      latitude,
      longitude,
      address,
      ac,
      musicSystem,
      autoWindow,
      sunroof,
      touchScreen,
      sevenSeater,
      reverseCamera,
      transmission,
      airBags,
      fuelType,
      petFriendly,
      powerSteering,
      abs,
      tractionControl,
      fullBootSpace,
      keylessEntry,
      airPurifier,
      cruiseControl,
      voiceControl,
      usbCharger,
      bluetooth,
      airFreshner,
      ventelatedFrontSeat,
      helmet,
      helmetSpace,
      costperhr,
      additionalInfo
    } = req.body;

    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid } });
    if (!vehicle) {
      return res.status(400).json({ message: 'Vehicle not found' });
    }

    const updateData = {
      latitude: latitude,
      longitude: longitude,
      address: address,
      Additionalinfo: additionalInfo,
      verification_status: 1,
    };

    const imageFields = {
      vehicleImage_1: 'vehicleimage1',
      vehicleImage_2: 'vehicleimage2',
      vehicleImage_3: 'vehicleimage3',
      vehicleImage_4: 'vehicleimage4',
      vehicleImage_5: 'vehicleimage5'
    };
    
    const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: vehicleid } });

    
    for (const [requestField, dbField] of Object.entries(imageFields)) {
      if (req.files[requestField]) {
        updateData[dbField] = req.files[requestField][0].location;
      } else if (req.body[requestField] == '') {
        const imageKey = vehicleAdditional[dbField];
        if (imageKey) {
          await deleteFromS3(imageKey);
          updateData[dbField] = null;
        }
      }
    }

    const updatedvehicleAdditional = await vehicleAdditional.update(updateData, { where: { vehicleid: vehicleid } });
    if (costperhr) {
      const Price = await Pricing.findOne({ where: { vehicleid: vehicleid } })
      if(Price){
        await Price.update( { costperhr : costperhr });
      }
    }
    let Additional;
    if( vehicle.vehicletype == 1 ){
       Additional = await Bike.findOne({ where: { vehicleid: vehicleid } });
      await Additional.update( { 
        HorsePower: horsePower, helmet: helmet, helmetSpace:helmetSpace, FuelType: fuelType })
    }
    if( vehicle.vehicletype == 2 ){
      Additional = await Car.findOne({ where: { vehicleid: vehicleid } });
      await Additional.update( { 
        HorsePower: horsePower,
        AC: ac,
        FuelType: fuelType,
        Musicsystem: musicSystem,
        Autowindow: autoWindow,
        Sunroof: sunroof,
        Touchscreen: touchScreen,
        Sevenseater: sevenSeater,
        Reversecamera: reverseCamera,
        Transmission: transmission,
        Airbags: airBags,
        FuelType: fuelType,
        PetFriendly: petFriendly,
        PowerSteering: powerSteering,
        ABS: abs,
        tractionControl: tractionControl,
        fullBootSpace: fullBootSpace,
        KeylessEntry: keylessEntry,
        airPurifier: airPurifier,
        cruiseControl: cruiseControl,
        voiceControl: voiceControl,
        usbCharger: usbCharger,
        bluetooth: bluetooth,
        airFreshner: airFreshner,
        ventelatedFrontSeat: ventelatedFrontSeat 
      })
    }

    const vehicleAdditionals = {
      vehicleid: updatedvehicleAdditional.vehicleid,
      vehicleImage1: updatedvehicleAdditional.vehicleimage1,
      vehicleImage2: updatedvehicleAdditional.vehicleimage2,
      vehicleImage3: updatedvehicleAdditional.vehicleimage3,
      vehicleImage4: updatedvehicleAdditional.vehicleimage4,
      vehicleImage5: updatedvehicleAdditional.vehicleimage5,
      latitude: updatedvehicleAdditional.latitude,
      longitude: updatedvehicleAdditional.longitude,
      address: updatedvehicleAdditional.address,
      verificationStatus: updatedvehicleAdditional.verification_status,
    };

    res.status(201).json({ message: 'Vehicle Additional added', vehicleAdditionals, Additional});
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error Adding Vehicle Additional Details' });
  }
});


router.post('/features', authenticate, async (req, res) => {

  try {
    const {
      featureid,
      vehicleid,
      price
    } = req.body;
    const feature = await Feature.findOne({ where: { id: featureid } });
    if (!feature) {
      return res.status(400).json({ message: 'Feature not available' });
    }
    else {
      const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid, hostId: req.user.id } });
      if (!vehicle) {
        return res.status(400).json({ message: 'vehicle is not available' });
      }
      const carfeature = await carFeature.findOne({ where: { featureid: featureid, vehicleid: vehicleid } });
      if (carfeature) {
        return res.status(400).json({ message: 'vehicle feature already added' });
      }
      const updated_feature = await carFeature.create({
        featureid: featureid,
        vehicleid: vehicleid,
        price: price
      });
      let response = {
        vehicleid: updated_feature.vehicleid,
        featureid: updated_feature.featureid,
        price: updated_feature.price,
      }
      res.status(201).json({ message: 'Feature with Price added', response });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error Adding car feature Details' });
  }
});
// Update Feature
router.put('/features', authenticate, async (req, res) => {
  try {
    const { featureid, vehicleid, price } = req.body;

    const carFeatureRecord = await carFeature.findOne({ where: { featureid, vehicleid } });
    if (!carFeatureRecord) {
      return res.status(404).json({ message: 'Feature not found for the car' });
    }

    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid, hostId: req.user.id } });
    if (!vehicle) {
      return res.status(400).json({ message: 'vehicle is not available' });
    }

    await carFeatureRecord.update({ price });

    res.status(200).json({ message: 'Feature price updated successfully', carFeatureRecord });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating car feature details' });
  }
});

// Delete Feature
router.delete('/features', authenticate, async (req, res) => {
  try {
    const { featureid, vehicleid } = req.body;

    const carFeatureRecord = await carFeature.findOne({ where: { featureid, vehicleid } });
    if (!carFeatureRecord) {
      return res.status(404).json({ message: 'Feature not found for the car' });
    }

    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid, hostId: req.user.id } });
    if (!vehicle) {
      return res.status(400).json({ message: 'vehicle is not available' });
    }

    await carFeatureRecord.destroy();

    res.status(200).json({ message: 'Feature deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting vehicle feature' });
  }
});

//Listing
router.get('/listing', authenticate, async (req, res) => {
  const hostid = req.user.userid;
  const host = await Host.findOne({ where: { id: hostid } });
  if (host) {
    try {
      const listing = await Listing.findAll({ where: { hostid: hostid } });
      const listings = listing.map(async (lstg) => {
        let vehicle = await Vehicle.findOne({ where: { vehicleid: lstg.vehicleid, hostId: hostid } });
        if (!vehicle) {
          return;
        }
         let vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: lstg.vehicleid } });
        let lk = {
          id: lstg.id,
          vehicleid: lstg.vehicleid,
          hostId: lstg.hostid,
          details: lstg.details,
          startDate: lstg.start_date,
          startTime: lstg.start_time,
          endDate: lstg.end_date,
          endTime: lstg.end_time,
          pauseTimeStartDate: lstg.pausetime_start_date,
          pauseTimeEndDate: lstg.pausetime_end_date,
          pauseTimeStartTime: lstg.pausetime_start_time,
          pauseTimeEndTime: lstg.pausetime_end_time,
          bookingId: lstg.bookingId,
          rcNumber: vehicle.Rcnumber,
          vehicletype: vehicle.vehicletype,
          vehicleImage1: vehicleAdditional.vehicleimage1,
          vehicleImage2: vehicleAdditional.vehicleimage2,
          vehicleImage3: vehicleAdditional.vehicleimage3,
          vehicleImage4: vehicleAdditional.vehicleimage4,
          vehicleImage5: vehicleAdditional.vehicleimage5,
        }
        return { ...lk };
      });
      const hostListings = await Promise.all(listings);
      res.status(201).json({ message: "Listing successfully queried", hostListings })
    }
    catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error showing listings' });
    }
  }
  else {
    res.status(401).json({ message: 'Unauthorized User' });
  }

});

//Delete Listing
router.delete('/listing', authenticate, async (req, res) => {
  try {
    // Get the listing ID from the request parameters
    const listingId = req.body.listingId;
    const hostid = req.user.userid;

    // Check if the authenticated user is a host
    const host = await Host.findOne({ where: { id: hostid } });
    if (!host) {
      return res.status(401).json({ message: 'Unauthorised User' });
    }

    // Find the listing
    const listing = await Listing.findOne({
      where: { id: listingId, hostid },
    });

    // If the listing doesn't exist or doesn't belong to the host, return an error
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    await listing.destroy();
    res.status(201).json({ message: 'Listing reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting listing' });
  }
});
router.get('/get-brand', async (req, res) => {
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
            logo_path:  row[1]
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
});
router.post('/pricing', async (req, res) => {
  try {
    const { vehicleid } = req.body;
    const Price = await Pricing.findOne({ where: { vehicleid: vehicleid } })
    if (Price) {
      res.status(201).json({ "message": "price for the vehicle", vehicleid: Price.vehicleid, costPerHr: Price.costperhr });
    }
    else {
      res.status(400).json({ "message": "pricing cannot be found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error checking Pricing' });
  }
});


//Put Listing

router.put('/listing', authenticate, async (req, res) => {
  try {
    // Get the listing ID from the request body
    const { listingId, details, startDate, startTime, endDate, endTime, pauseTimeStartDate, pauseTimeEndDate, pauseTimeEndTime, pauseTimeStartTime, hourCount } = req.body;
    const hostid = req.user.userid;
    const host = await Host.findOne({ where: { id: hostid } });
    // Check if the authenticated user is a host
    if (!host) {
      return res.status(401).json({ message: 'Unauthorized User' });
    }

    const listing = await Listing.findOne({
      where: { id: listingId, hostid: hostid },
    });

    // If the listing doesn't exist or doesn't belong to the host, return an error
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    // Update the listing's details
    await listing.update({
      details: details,
      start_date: startDate,
      start_time: startTime,
      end_date: endDate,
      end_time: endTime,
      pausetime_start_date: pauseTimeStartDate,
      pausetime_end_date: pauseTimeEndDate,
      pausetime_start_time: pauseTimeStartTime,
      pausetime_end_time: pauseTimeEndTime,
      hourcount: hourCount
    });

    const listings = {
      id: listing.id,
      vehicleid: listing.vehicleid,
      hostId: listing.hostid,
      details: listing.details,
      startDate: listing.start_date,
      startTime: listing.start_time,
      endDate: listing.end_date,
      endTime: listing.end_time,
      pauseTimeStartDate: listing.pausetime_start_date,
      pauseTimeEndDate: listing.pausetime_end_date,
      pauseTimeStartTime: listing.pausetime_start_time,
      pauseTimeEndTime: listing.pausetime_end_time,
      bookingId: listing.bookingId
    }

    res.status(200).json({ message: 'Listing updated successfully', updatedListing: listings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating listing' });
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

router.put('/profile', authenticate, async (req, res) => {
  try {
    const hostId = req.user.id;
    const host = await Host.findByPk(hostId);
    if (!host) {
      return res.status(404).json({ message: 'Host not found' });
    }

    // Update additional user information
    const { fullName, aadharId, email, address, businessName, GSTnumber, PANnumber, onlyVerifiedUsers } = req.body;

    if (fullName || aadharId || email || address || businessName || GSTnumber || PANnumber) {
      await HostAdditional.update({
        FullName: fullName,
        businessName: businessName,
        GSTnumber: GSTnumber,
        PANnumber: PANnumber,
        AadharVfid: aadharId,
        Email: email,
        Address: address,
      }, { where: { id: hostId } });
    }

    // Update host's preference for only verified users
    if (onlyVerifiedUsers !== undefined) {
      await host.update({ onlyVerifiedUsers });
    }

    res.status(200).json({ message: 'Profile Updated successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error updating profile', error: error });
  }
});

router.post('/monthly-data', authenticate, async (req, res) => {
  const { vehicleid } = req.body;
  try {
    const monthlyData = await Booking.findAll({
      attributes: [
        [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('endTripDate')), 'month'],
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'totalAmount'],
        [Sequelize.fn('COUNT', Sequelize.col('Bookingid')), 'numberOfBookings']
      ],
      where: {
        vehicleid: vehicleid,
        endTripDate: {
          [Op.ne]: null // Ensure the Date is not null
        },
        status: '3',
      },
      group: [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('endTripDate'))],
      order: [[Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('endTripDate')), 'ASC']]
    });

    const formattedMonthlyData = monthlyData.map(row => ({
      month: row.get('month'),
      totalAmount: row.get('totalAmount'),
      numberOfBookings: row.get('numberOfBookings')
    }));

    res.status(200).json({
      monthlyData: formattedMonthlyData,
    });
  } catch (error) {
    console.error('Error fetching monthly data:', error);
  }
});
//Host-Bookings
router.get('/host-bookings', authenticate, async (req, res) => {
  try {
    const hostid = req.user.id;
    let bookings = await Booking.findAll({
      include: [
        {
          model: Vehicle,
          where: { hostId: hostid },
          attributes: ['chassisno', 'Rcnumber', 'Enginenumber'],
        },
        {
          model: UserAdditional,
          attributes: ['FullName'] // Assuming 'FullName' is the column name in 'UserAdditional'
        }
      ],
    });
    if (bookings) {
      const featureList = await Feature.findAll();
      const featureMap = featureList.reduce((map, feature) => {
        map[feature.id] = feature.featureName;
        return map;
      }, {});
      const hostBooking = bookings.map(async (booking) => {
        const vehicle = await Vehicle.findOne({
          where: {
            vehicleid: booking.vehicleid,
          }
        });
        if (!vehicle) {
          return;
        }
        const featureDetails = (booking.features || []).map(featureId => ({
          featureId,
          featureName: featureMap[featureId] || 'Unknown Feature'
        }));
        let bk = {
          bookingId: booking.Bookingid,
          vehicleid: booking.vehicleid,
          id: booking.id,
          bookedBy: booking.UserAdditional ? booking.UserAdditional.FullName : null,
          status: booking.status,
          amount: booking.amount,
          startTripDate: booking.startTripDate,
          endTripDate: booking.endTripDate,
          startTripTime: booking.startTripTime,
          endTripTime: booking.endTripTime,
          cancelDate: booking.cancelDate,
          cancelReason: booking.cancelReason,
          features: featureDetails,
          createdAt: booking.createdAt,
        }
        return { ...bk };
      });
      const hostBookings = await Promise.all(hostBooking);
      res.status(201).json({ hostBookings: hostBookings });
    }
    else {
      res.status(400).json({ message: 'No bookings found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.post('/rating', authenticate, async (req, res) => {
  try {
    let { bookingId, rating } = req.body;
    if (!rating) {
      rating = 5;
    }
    const userId = req.user.id;
    const booking = await Booking.findOne({
      where: {
        Bookingid: bookingId,
        //id: userId,
      }
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    const user = await User.findOne({
      where: {
        id: booking.id,
      }
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const bookingCount = await Booking.count({
      where: {
        id: booking.id,
        status: 3,
      }
    });
    let new_rating;
    if( bookingCount == 1 ){
      new_rating = parseFloat(rating);     
    }
    else{
      new_rating = (parseFloat(rating) + parseFloat(user.rating * (bookingCount - 1))) / (bookingCount);
    }
    user.update({ rating: new_rating });
    res.status(201).json('Thank you for your response');
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const getBookingDetails = async (bookingId) => {
  try {
    const booking = await Booking.findOne({
      where: { Bookingid: bookingId }});

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Fetch the host's user details using the hostId from the vehicle model
    const user = await UserAdditional.findOne({
      where: { id: booking.id }
    });
    const host = await Vehicle.findOne({
      where: { vehicleid: booking.vehicleid }
    })

    const userEmail = user?.Email;
    const hostId = host?.hostId;
    var hostEmail =  await UserAdditional.findOne({
      where: { id: hostId }
    });
    const bookingDetails = {
      carModel: host.carmodel,
      startDate: booking.startTripDate,
      startTime: booking.startTripTime,
      endDate: booking.endTripDate,
      endTime:booking.endTripTime,
    };  
    hostEmail = hostEmail.Email;
    return { userEmail, hostEmail, bookingDetails };
  } catch (error) {
    console.error('Error in getBookingDetails:', error);
    throw error;
  }
};



router.post('/getFeedback', authenticate, async (req, res) => {
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

});
router.post('/getVehicleAdditional', authenticate, async (req, res) => {
  const { vehicleid } = req.body;
  const hostId = req.user.id; // Assuming the host ID is part of the authenticated user details

  try {
    // Check if the host owns the car
    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid, hostId: hostId } });
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
});



router.post('/getCarReg', async (req, res) => {
  const { RegID } = req.body;
  const soapEnvelope = `
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://regcheck.org.uk">
      <soap:Header/>
      <soap:Body>
        <web:CheckIndia>
          <web:RegistrationNumber>${RegID}</web:RegistrationNumber>
          <web:username>Pratyay</web:username>
        </web:CheckIndia>
      </soap:Body>
    </soap:Envelope>
  `;

  try {
    const response = await fetch('https://www.regcheck.org.uk/api/reg.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://regcheck.org.uk/CheckIndia"'
      },
      body: soapEnvelope
    });

    const responseBody = await response.text();

    parseString(responseBody, { explicitArray: false }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        res.status(500).json({ error: 'Error parsing XML' });
        return;
      }
      try {
        console.log(result);
        const payload = result; // the parsed XML structure
        const vehicle_json_str = payload["soap:Envelope"]["soap:Body"]["CheckIndiaResponse"]["CheckIndiaResult"]["vehicleJson"];

        const vehicle_json = JSON.parse(vehicle_json_str);

        const vehicle_data = payload["soap:Envelope"]["soap:Body"]["CheckIndiaResponse"]["CheckIndiaResult"]["vehicleData"];
        const final_json = {
          Description: vehicle_data.Description,
          RegistrationYear: vehicle_data.RegistrationYear,
          CarMake: vehicle_data.CarMake.CurrentTextValue,
          CarModel: vehicle_data.CarModel,
          EngineSize: vehicle_data.EngineSize.CurrentTextValue
        };

        console.log(JSON.stringify(final_json, null, 4));
        res.status(200).json(final_json);
      } catch (error) {
        console.error('Error processing data:', error);
        res.status(500).json({ error: 'Error processing data' });
      }
    });

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Error fetching data' });
  }
});

router.get('/device/:vehicleid', authenticate, async (req, res) => {
  try {
    const id = req.params.vehicleid;
    const limit = parseInt(req.query.limit, 10) || 10; 
    const hostId = req.user.id;
    const vehicle = await Vehicle.findOne({ where: { vehicleid: id, hostId: hostId } });
    if (!vehicle) {
      return res.status(404).json({ message: 'vehicle not found or unauthorized access' });
    }
    const device = await carDevices.findOne({ where: { vehicleid: id } });
    if (!device) {
      return res.status(404).json({ message: 'vehicle not available for tracking' });
    }
    const results = await Device.findAll({
      where: {
        deviceid: device.deviceid,
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

//Support for host
// Create a support ticket
router.post('/support', authenticate, createSupportTicket);

// Add a message to a support ticket
router.post('/support/message', authenticate, addSupportMessage);

router.post('/support/supportChat', authenticate, viewSupportChats);

router.get('/support', authenticate, viewUserSupportTickets);

router.get('/view-blog',authenticate, getAllBlogs );

router.post('/activate-vehicle', authenticate, async (req, res) => {
  const { vehicleid, paymentMethod } = req.body;

  try {
    const host = await Host.findByPk(req.user.id);
    if (!host) {
      return res.status(401).json({ message: 'No Host found' });
    }

    const vehicle = await Vehicle.findOne({ where: { vehicleid, hostId: req.user.id } });
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    // Process payment (this is a placeholder, replace with actual payment processing logic)
    const paymentId = uuid.v4();
    const amount = 100; // Example amount, replace with actual amount

    await HostPayment.create({
      PaymentId: paymentId,
      HostId: req.user.id,
      VehicleId: vehicleid,
      PaymentDate: new Date(),
      Amount: amount,
      GSTAmount: amount * 0.18,
      TotalAmount: amount * 1.18,
      PaymentStatus: 1, // Assuming 1 means successful
      PaymentMethod: paymentMethod,
      TransactionId: uuid.v4(),
      Remarks: 'Vehicle activation payment'
    });

    await vehicle.update({ activated: true });

    res.status(200).json({ message: 'Vehicle activated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error activating vehicle' });
  }
});

router.post('/Trip-Started', authenticate, tripstart);

router.post('/booking-completed', authenticate, bookingcompleted);

module.exports = router;