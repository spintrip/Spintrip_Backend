const express = require('express');
const uuid = require('uuid');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../Middleware/authMiddleware');
const {
  Driver, CabToDriver, CabBookingRequest, CabBookingAccepted, DriverKeepAlive,
  Host, Vehicle, VehicleAdditional, Cab, Pricing, Listing
} = require('../Models');
const { sendOTP, generateOTP } = require('../Controller/hostController');
const { publishMessage } = require('../Controller/pubsubController');
const CabToDriver = require('../Models/CabtoDriverModel');
const { where } = require('sequelize');
const router = express.Router();

/** ======================= Driver Routes ======================= **/

// Driver Signup with OTP Verification
router.post('/driver/signup', authenticate, async (req, res) => {
  const { phone, name } = req.body;

  try {
    const hostId = req.user.id; // Get host ID from the authenticated token
    const host = await Host.findByPk(hostId);
    if (!host) return res.status(404).json({ message: 'Host not found' });

    const existingDriver = await Driver.findOne({ where: { phone } });
    if (existingDriver) {
      return res.status(400).json({ message: 'Driver already exists. Please log in.' });
    }

    const driverId = uuid.v4();
    const otp = generateOTP();
    
    // Create driver with default password as `1234`
    const driver = await Driver.create({
      id: driverId,
      phone:phone,
      name:name,
      hostid: hostId,
      otp:otp,
      password: '1234',
    });
    console.log(driver);
    sendOTP(phone, otp);
    res.status(201).json({ message: 'Driver added. OTP sent for verification.', driverId });
  } catch (error) {
    console.error('Error during driver signup:', error);
    res.status(500).json({ message: 'Error adding driver', error });
  }
});
// Driver OTP Verification
router.post('/driver/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;

  try {
    const driver = await Driver.findOne({ where: { phone } });
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    if (driver.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    const JWT_SECRET = 'your_secret_key';

    const token = jwt.sign({ id: driver.id, role: 'driver' }, JWT_SECRET, { expiresIn: '1d' });
    res.status(200).json({ message: 'OTP verified successfully', token });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Error verifying OTP', error });
  }
});
router.post('/driver/login', async (req, res) => {
  const { phone } = req.body;

  try {
    const driver = await Driver.findOne({ where: { phone } });
    if (!driver) return res.status(404).json({ message: 'Driver not found. Please sign up.' });

    const otp = generateOTP();
    await driver.update({ otp });

    sendOTP(phone, otp);
    res.status(200).json({ message: 'OTP sent successfully to the provided phone number.' });
  } catch (error) {
    console.error('Error during driver login:', error);
    res.status(500).json({ message: 'Error during login', error });
  }
});
// Driver Keep-Alive
router.post('/driver/keep-alive', authenticate, async (req, res) => {
  const { latitude, longitude } = req.body;
  const driverId = req.user.id;

  try {
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Missing latitude or longitude' });
    }

    // Update the driver's location in the database
    const vehicleId = CabToDriver.findOne({where: {driverId:driverId}});
    await VehicleAdditional.update(
      { latitude, longitude },
      { where: { vehicleid: vehicleId.vehicleId } }
    );

    res.status(200).json({ message: 'Location updated successfully' });
  } catch (error) {
    console.error('Error in keep-alive:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
/** ======================= Host Routes ======================= **/

// Add Driver
router.post('/add-driver', authenticate, async (req, res) => {
  const { name, phone } = req.body;
  const hostId = req.user.id;

  try {
    const driverId = uuid.v4();
    const otp = generateOTP();

    const driver = await Driver.create({
      id: driverId,
      hostid: hostId,
      name,
      phone,
      otp,
      password: '1234', // Default password
    });

    sendOTP(phone, otp);
    res.status(201).json({ message: 'Driver added. OTP sent for verification.', driverId });
  } catch (error) {
    console.error('Error adding driver:', error);
    res.status(500).json({ message: 'Error adding driver', error });
  }
});

// Assign Driver to Vehicle
router.post('/assign-driver', authenticate, async (req, res) => {
  const { driverId, vehicleId } = req.body;
  const hostId = req.user.id;

  try {
    const driver = await Driver.findOne({ where: { id: driverId, hostid: hostId } });
    if (!driver) return res.status(404).json({ message: 'Driver not found or unauthorized' });

    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleId, hostId } });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found or unauthorized' });

    await CabToDriver.upsert({ driverid: driverId, vehicleid: vehicleId, assignedAt: new Date() });

    res.status(200).json({ message: 'Driver assigned to vehicle successfully.' });
  } catch (error) {
    console.error('Error assigning driver:', error);
    res.status(500).json({ message: 'Error assigning driver', error });
  }
});

// Get All Drivers for Host
router.get('/host/drivers', authenticate, async (req, res) => {
  const hostId = req.user.id;

  try {
    const drivers = await Driver.findAll({ where: { hostid: hostId } });
    res.status(200).json({ drivers });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ message: 'Error fetching drivers', error });
  }
});

/** ======================= Booking Management Routes ======================= **/

// Create Booking Request
router.post('/booking/request', authenticate, async (req, res) => {
  const { vehicleId, startLocation, endLocation, estimatedPrice } = req.body;
  const userId = req.user.id;

  try {
    const bookingId = uuid.v4();
    const bookingRequest = await CabBookingRequest.create({
      bookingId,
      userId,
      vehicleId,
      startLocationLatitude: startLocation.latitude,
      startLocationLongitude: startLocation.longitude,
      endLocationLatitude: endLocation.latitude,
      endLocationLongitude: endLocation.longitude,
      estimate_price: estimatedPrice,
      status: 'pending',
    });

    await publishMessage('cab-booking', { bookingId, userId, vehicleId, estimatedPrice, event: 'request' });
    res.status(201).json({ message: 'Booking request created', bookingRequest });
  } catch (error) {
    console.error('Error creating booking request:', error);
    res.status(500).json({ message: 'Error creating booking request', error });
  }
});

// Accept Booking
router.post('/booking/accept', authenticate, async (req, res) => {
  const { bookingId } = req.body;
  const driverId = req.user.id;

  try {
    const booking = await CabBookingRequest.findByPk(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'pending') return res.status(400).json({ message: 'Booking already processed' });

    await booking.update({ driverId, status: 'accepted' });
    await CabBookingAccepted.create({ bookingId, driverId, acceptedAt: new Date() });

    await publishMessage('cab-booking', { bookingId, driverId, event: 'accept' });
    res.status(200).json({ message: 'Booking accepted successfully.' });
  } catch (error) {
    console.error('Error accepting booking:', error);
    res.status(500).json({ message: 'Error accepting booking', error });
  }
});

// Complete Booking
router.post('/booking/complete', authenticate, async (req, res) => {
  const { bookingId } = req.body;
  const driverId = req.user.id;

  try {
    const booking = await CabBookingRequest.findOne({ where: { bookingId, driverId } });
    if (!booking) return res.status(404).json({ message: 'Booking not found or unauthorized' });

    await booking.update({ status: 'completed', endTripTime: new Date() });

    await publishMessage('cab-booking', { bookingId, driverId, event: 'complete' });
    res.status(200).json({ message: 'Booking completed successfully.' });
  } catch (error) {
    console.error('Error completing booking:', error);
    res.status(500).json({ message: 'Error completing booking', error });
  }
});

// Add a Cab
router.post('/add', authenticate, async (req, res) => {
  const { vehicleModel, type, brand, variant, color, bodyType, chassisNo, rcNumber, engineNumber, registrationYear, city, latitude, longitude, address, timeStamp } = req.body;

  try {
    const host = await Host.findByPk(req.user.id);
    if (!host) return res.status(401).json({ message: 'Host not found' });

    const vehicleId = uuid.v4();
    const vehicle = await Vehicle.create({ vehicletype: 3, chassisno: chassisNo, Rcnumber: rcNumber, Enginenumber: engineNumber, Registrationyear: registrationYear, vehicleid: vehicleId, hostId: req.user.id, timestamp: timeStamp, activated: false });
    await VehicleAdditional.create({ vehicleid: vehicleId, latitude, longitude, address });
    await Cab.create({ vehicleid: vehicleId, cabmodel: vehicleModel, type, brand, variant, color, bodytype: bodyType, city });
    await Pricing.create({ vehicleid: vehicleId });
    await Listing.create({ id: uuid.v4(), vehicleid: vehicleId, hostid: req.user.id });
    res.status(201).json({ message: 'Cab added successfully', vehicleId });
  } catch (error) {
    console.error('Error adding cab:', error);
    res.status(500).json({ message: 'Error adding cab', error });
  }
});

module.exports = router;
