const axios = require('axios');
const uuid = require('uuid');
const { Vehicle, Pricing, Booking, Feature } = require('../Models');
const { publishMessage, waitForResponse } = require('../Controller/pubsubController');

// Google Maps API Configuration
const GOOGLE_MAPS_API_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

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

    const response = await axios.get(GOOGLE_MAPS_API_URL, {
      params: {
        origins: `${startLocation.latitude},${startLocation.longitude}`,
        destinations: `${endLocation.latitude},${endLocation.longitude}`,
        key: GOOGLE_MAPS_API_KEY,
        departure_time: 'now', // Real-time traffic consideration
        traffic_model: 'best_guess', // Optimize for real-time traffic
      },
    });

    if (!response.data || !response.data.rows || !response.data.rows.length) {
      return res.status(500).json({ message: 'Error fetching distance from Google Maps API' });
    }

    const distance = response.data.rows[0].elements[0].distance.value / 1000; // Convert meters to kilometers
    const duration = response.data.rows[0].elements[0].duration.value / 60; // Convert seconds to minutes

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
    console.error('Error calculating estimate:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

/**
 * Book a cab and notify the driver.
 */
const bookCab = async (req, res) => {
  const { vehicleid, startDate, endDate, startTime, endTime, features } = req.body;
  const userId = req.user.id;

  try {
    // Validate booking dates and times
    if (!startDate || !endDate || !startTime || !endTime) {
      return res.status(400).json({ message: 'Invalid or missing booking dates/times.' });
    }

    const vehicle = await Vehicle.findByPk(vehicleid);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    const bookingId = uuid.v4();
    let totalAmount = 0;

    const pricing = await Pricing.findOne({ where: { vehicleid } });
    if (pricing) {
      const hours = calculateTripHours(startDate, endDate, startTime, endTime);
      totalAmount = pricing.costperhr * hours;

      if (features) {
        for (const featureId of features) {
          const feature = await Feature.findByPk(featureId);
          if (feature) totalAmount += feature.price;
        }
      }
    }

    await Booking.create({
      Bookingid: bookingId,
      vehicleid,
      id: userId,
      startTripDate: startDate,
      endTripDate: endDate,
      startTripTime: startTime,
      endTripTime: endTime,
      amount: totalAmount,
      status: 1, // Pending
    });

    await publishMessage('booking-notification', {
      bookingId,
      vehicleId: vehicleid,
      userId,
      startDate,
      startTime,
    });

    res.status(201).json({ message: 'Cab booked successfully', bookingId, totalAmount });
  } catch (error) {
    console.error('Error booking cab:', error);
    res.status(500).json({ message: 'Server error', error });
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
