const axios = require('axios');
const uuid = require('uuid');
const { Vehicle, Pricing, Booking, Feature } = require('../Models');
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
  const { latitude, longitude, distance } = req.body;

  try {
    if (!latitude || !longitude || !distance) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    const searchRequestId = uuid.v4();
    await publishMessage('search-cabs', { searchRequestId, latitude, longitude, distance });

    const response = await waitForResponse('search-response', searchRequestId, 5000);

    if (!response || !response.availableCabs) {
      return res.status(404).json({ message: 'No cabs available in the specified area.' });
    }

    res.status(200).json({ message: 'Cabs found', availableCabs: response.availableCabs });
  } catch (error) {
    console.error('Error searching for cabs:', error);
    res.status(500).json({ message: 'Server error', error });
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

module.exports = {
  searchForCabs,
  getEstimate,
  bookCab,
};
