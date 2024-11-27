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
const { sendNotification } = require('../NotificationManagement');
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
      phone,
      name,
      hostid: hostId,
      otp,
      password: '1234',
    });

    // Publish OTP event for notifications
    await publishMessage('otp-notification', { phone, otp });

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
    const JWT_SECRET = process.env.JWT_SECRET;

    const token = jwt.sign({ id: driver.id, role: 'driver' }, JWT_SECRET, { expiresIn: '1d' });
    res.status(200).json({ message: 'OTP verified successfully', token });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Error verifying OTP', error });
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
    const vehicleId = await CabToDriver.findOne({ where: { driverid: driverId } });
    if (!vehicleId) return res.status(404).json({ message: 'Driver vehicle not found' });

    await VehicleAdditional.update(
      { latitude, longitude },
      { where: { vehicleid: vehicleId.vehicleid } }
    );

    // Publish driver location update event
    await publishMessage('driver-location', { driverId, latitude, longitude });

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

    // Publish OTP notification
    await publishMessage('otp-notification', { phone, otp });

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

    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleId, hostid: hostId } });
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

    // Publish booking request event
    await publishMessage('booking-requests', {
      bookingId,
      userId,
      vehicleId,
      estimatedPrice,
      startLocation,
      endLocation,
    });

    res.status(201).json({ message: 'Booking request created', bookingRequest });
  } catch (error) {
    console.error('Error creating booking request:', error);
    res.status(500).json({ message: 'Error creating booking request', error });
  }
});

module.exports = router;
