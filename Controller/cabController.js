const axios = require('axios');
const uuid = require('uuid');
const { Host, Vehicle, VehicleAdditional, Cab, Pricing, Listing } = require('../Models');
const { publishMessage, waitForResponse } = require('../Controller/pubsubController');

// Google Maps API Configuration
const GOOGLE_MAPS_API_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
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
  const { fromLocation, toLocation, searchRadius } = req.body;
  console.log(req.body)
  try {
    // Validate request parameters
    if (!fromLocation || !toLocation || !searchRadius) {
      return res.status(400).json({ message: 'Missing required parameters: fromLocation, toLocation, or searchRadius' });
    }

    const { latitude: fromLat, longitude: fromLng } = fromLocation;
    console.log(fromLocation,toLocation);
    // Find cabs within the search radius from the 'fromLocation'
    const nearbyCabs = await VehicleAdditional.findAll({
      where: sequelize.literal(`
        ST_Distance_Sphere(
          POINT(${fromLng}, ${fromLat}),
          POINT(longitude, latitude)
        ) <= ${searchRadius * 1000}  -- Convert radius from km to meters
      `),
      include: [
        {
          model: Vehicle,
          where: { vehicletype: 3 }, // Ensure it's a cab
        },
      ],
    });

    if (!nearbyCabs.length) {
      return res.status(404).json({ message: 'No cabs available within the specified area.' });
    }

    const results = nearbyCabs.map((cab) => ({
      vehicleId: cab.vehicleid,
      latitude: cab.latitude,
      longitude: cab.longitude,
      address: cab.address,
      distanceFromStart: cab.distance, // Calculated by SQL if using distance
    }));

    res.status(200).json({
      message: 'Cabs found',
      availableCabs: results,
      fromLocation,
      toLocation,
    });
  } catch (error) {
    console.error('Error searching for cabs:', error);
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
