const axios = require('axios');
const uuid = require('uuid');
const { Host, Vehicle, VehicleAdditional, Cab, Pricing, Listing } = require('../Models');
const { publishMessage, waitForResponse } = require('../Controller/pubsubController');
const sequelize = require('../Models').sequelize; // Google Maps API Configuration
const GOOGLE_MAPS_API_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const { Op } = require('sequelize');

async function getDistanceAndDuration(origin, destination) {
  try {
    const response = await axios.get(GOOGLE_MAPS_API_URL, {
      params: {
        origins: `${origin.latitude},${origin.longitude}`,
        destinations: `${destination.latitude},${destination.longitude}`,
        key: GOOGLE_MAPS_API_KEY,
      },
    });

    const { rows } = response.data;

    if (rows[0].elements[0].status !== 'OK') {
      throw new Error(`Google API error: ${rows[0].elements[0].status}`);
    }

    const { distance, duration } = rows[0].elements[0];

    return {
      distance: distance.value / 1000, // Convert meters to kilometers
      duration: duration.value / 60,  // Convert seconds to minutes
    };
  } catch (error) {
    console.error('Error fetching data from Google Maps API:', error.message);
    throw new Error('Failed to fetch distance and duration');
  }
}
/**
 * Search for cabs within a specified area.
 */
const searchForCabs = async (req, res) => {
  const { fromLocation, searchRadius } = req.body;
  const {latitude,longitude} = fromLocation;
  const maxLatitude = latitude + searchRadius / 111; // 1 degree latitude ≈ 111 km
  const minLatitude = latitude - searchRadius / 111;
  const maxLongitude = longitude + searchRadius / (111 * Math.cos(latitude * (Math.PI / 180)));
  const minLongitude = longitude - searchRadius / (111 * Math.cos(latitude * (Math.PI / 180)));
  
  try {
    if (!fromLocation || !searchRadius) {
      return res.status(400).json({ message: 'Missing required parameters: fromLocation or searchRadius' });
    }

    const { latitude, longitude } = fromLocation;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Invalid location coordinates.' });
    }

    // Fetch all vehicles of type "cab" with their latitude and longitude
    const cabs = await VehicleAdditional.findAll({
      attributes: ['vehicleid', 'latitude', 'longitude', 'address'],
      where: {
        latitude: { [Op.between]: [minLatitude, maxLatitude] },
        longitude: { [Op.between]: [minLongitude, maxLongitude] },
      },
    });

    if (!cabs.length) {
      return res.status(404).json({ message: 'No cabs available.' });
    }

    // Filter cabs within the search radius
    const nearbyCabs = cabs
      .map((cab) => {
        const distance = geolib.getDistance(
          { latitude, longitude },
          { latitude: cab.latitude, longitude: cab.longitude }
        ) / 1000; // Convert to kilometers

        return {
          vehicleId: cab.vehicleid,
          address: cab.address,
          latitude: cab.latitude,
          longitude: cab.longitude,
          distance,
        };
      })
      .filter((cab) => cab.distance <= searchRadius);

    if (!nearbyCabs.length) {
      return res.status(404).json({ message: 'No cabs available within the specified radius.' });
    }

    res.status(200).json({
      message: 'Cabs found',
      nearbyCabs,
    });
  } catch (error) {
    console.error('Error searching for cabs:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
/**
 * Get an estimate for a trip using Google Maps API and dynamic pricing.
 */
const getEstimate = async (req, res) => {
  const { startLocation, endLocation, vehicleId, surgeRate } = req.body;

  try {
    if (!startLocation || !endLocation || !vehicleId) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    const { distance, duration } = await getDistanceAndDuration(startLocation, endLocation);

    const vehiclePricing = await Pricing.findOne({ where: { vehicleid: vehicleId } });
    if (!vehiclePricing) {
      return res.status(404).json({ message: 'Pricing information not found for this vehicle.' });
    }

    const basePrice = distance * vehiclePricing.costperkm;
    const surgeMultiplier = surgeRate || 1;
    const estimatedPrice = Math.round(basePrice * surgeMultiplier);

    res.status(200).json({
      message: 'Estimate calculated successfully',
      estimatedPrice,
      distance,
      duration,
    });
  } catch (error) {
    console.error('Error calculating estimate:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Book a cab and notify the driver.
 */
const bookCab = async (req, res) => {
  const { vehicleid, startLocation, endLocation, startDate, startTime } = req.body;
  const userId = req.user.id;

  try {
    const { distance } = await getDistanceAndDuration(startLocation, endLocation);

    const pricing = await Pricing.findOne({ where: { vehicleid } });
    if (!pricing) {
      return res.status(404).json({ message: 'Pricing information not found for this vehicle.' });
    }

    const amount = Math.round(distance * pricing.costperkm);

    const bookingId = uuid.v4();
    await Booking.create({
      Bookingid: bookingId,
      vehicleid,
      id: userId,
      startTripDate: startDate,
      startTripTime: startTime,
      amount,
      status: 1, // Pending
    });

    await publishMessage('booking-notification', {
      bookingId,
      vehicleId: vehicleid,
      userId,
      startDate,
      startTime,
    });

    res.status(201).json({ message: 'Cab booked successfully', bookingId, amount });
  } catch (error) {
    console.error('Error booking cab:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Utility function to calculate trip hours.
 */
const calculateTripHours = (startDate, endDate, startTime, endTime) => {
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);
  const hours = Math.abs((end - start) / (1000 * 60 * 60));
  return Math.ceil(hours);
};
// Add the following function inside cabRoutes.js
const addCab = async (req, res) => {
  const {
    vehicleModel,
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
    timeStamp,
  } = req.body;

  try {
    const host = await Host.findByPk(req.user.id);
    if (!host) {
      return res.status(401).json({ message: 'Host not found' });
    }

    const vehicleId = uuid.v4();

    const vehicle = await Vehicle.create({
      vehicletype: 3,
      chassisno: chassisNo,
      Rcnumber: rcNumber,
      Enginenumber: engineNumber,
      Registrationyear: registrationYear,
      vehicleid: vehicleId,
      hostId: req.user.id,
      timestamp: timeStamp,
      activated: false,
    });
    await VehicleAdditional.create({
      vehicleid: vehicleId,
      latitude,
      longitude,
      address,
    });

    await Cab.create({
      vehicleid: vehicleId,
      cabmodel: vehicleModel,
      type,
      brand,
      variant,
      color,
      bodytype: bodyType,
      city,
    });

    await Pricing.create({
      vehicleid: vehicleId,
    });

    await Listing.create({
      id: uuid.v4(),
      vehicleid: vehicleId,
      hostid: req.user.id,
    });

    res.status(201).json({
      message: 'Cab added successfully',
      vehicleId,
    });
  } catch (error) {
    console.error('Error adding cab:', error.message);
    res.status(500).json({ message: 'Error adding cab', error: error.message });
  }
};

// Export the addCab function
module.exports = {
  addCab,
  searchForCabs,
  getEstimate,
  bookCab,
};
