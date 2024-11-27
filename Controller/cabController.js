const axios = require("axios");
const uuid = require("uuid");
const {
  Host,
  Vehicle,
  VehicleAdditional,
  Cab,
  Pricing,
  Listing,
  CabBookingRequest,
  CabBookingAccepted,
  Driver, 
  CabToDriver,
  DriverKeepAlive
} = require("../Models");
const { sendNotification } = require("./adminController/notificationManagement");
const { publishMessage } = require("../Controller/pubsubController");
const sequelize = require("../Models").sequelize;
const { Op } = require("sequelize");
const geolib = require("geolib");

// Google Maps API Configuration
const GOOGLE_MAPS_API_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Get distance and duration using Google Maps API
 */
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

    if (rows[0].elements[0].status !== "OK") {
      throw new Error(`Google API error: ${rows[0].elements[0].status}`);
    }

    const { distance, duration } = rows[0].elements[0];

    return {
      distance: distance.value / 1000, // Convert meters to kilometers
      duration: duration.value / 60, // Convert seconds to minutes
    };
  } catch (error) {
    console.error("Error fetching data from Google Maps API:", error.message);
    throw new Error("Failed to fetch distance and duration");
  }
}

/**
 * Search for nearby cabs
 */
const searchForCabs = async (req, res) => {
  const { fromLocation, searchRadius } = req.body;

  try {
    if (!fromLocation || !searchRadius) {
      return res.status(400).json({ message: "Missing required parameters: fromLocation or searchRadius" });
    }

    const { latitude, longitude } = fromLocation;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Invalid location coordinates." });
    }

    // Calculate bounds for latitude and longitude
    const minLatitude = latitude - searchRadius / 111; // Approx. 1 degree latitude ≈ 111 km
    const maxLatitude = latitude + searchRadius / 111;
    const minLongitude = longitude - searchRadius / (111 * Math.cos(latitude * (Math.PI / 180)));
    const maxLongitude = longitude + searchRadius / (111 * Math.cos(latitude * (Math.PI / 180)));

    // Fetch all vehicles of type "cab" with their latitude and longitude
    const cabs = await VehicleAdditional.findAll({
      attributes: ['vehicleid', 'latitude', 'longitude', 'address'],
      where: {
        latitude: { [Op.between]: [minLatitude, maxLatitude] },
        longitude: { [Op.between]: [minLongitude, maxLongitude] },
      },
    });

    if (!cabs.length) {
      return res.status(404).json({ message: "No cabs available." });
    }

    // Filter cabs within the search radius
    const nearbyCabs = cabs
      .map((cab) => {
        const distance = geolib.getPreciseDistance(
          { latitude, longitude },
          { latitude: cab.latitude, longitude: cab.longitude }
        ) / 1000; // Convert meters to kilometers

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
      return res.status(404).json({ message: "No cabs available within the specified radius." });
    }

    res.status(200).json({
      message: "Cabs found",
      nearbyCabs,
    });
  } catch (error) {
    console.error("Error searching for cabs:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


/**
 * Book a cab and notify nearby drivers
 */
const bookCab = async (req, res) => {
  const { startLocation, endLocation, startDate, startTime, vehicleId } = req.body;
  const userId = req.user.id;

  try {
    // Validate input
    if (!startLocation || !endLocation || !vehicleId) {
      return res.status(400).json({ message: "Missing required parameters." });
    }

    // Estimate price internally
    const { estimatedPrice, distance } = await estimatePrice({
      origin: startLocation,
      destination: endLocation,
      vehicleId,
    });

    if (!estimatedPrice) {
      return res.status(500).json({ message: "Failed to estimate price." });
    }

    const bookingId = uuid.v4();

    // Create the booking request
    await CabBookingRequest.create({
      bookingId,
      userId,
      vehicleId,
      startLocationLatitude: startLocation.latitude,
      startLocationLongitude: startLocation.longitude,
      endLocationLatitude: endLocation.latitude,
      endLocationLongitude: endLocation.longitude,
      estimate_price: estimatedPrice,
      status: "pending",
    });

    // Notify drivers
    const notificationText = "New booking request nearby";
    const notificationMetadata = { bookingId, startLocation, endLocation, estimatedPrice };

    const drivers = await searchForCabs({ body: { fromLocation: startLocation, searchRadius: 5 } });

    for (const driver of drivers.nearbyDrivers) {
      if (driver.deviceToken) {
        await publishMessage(`driver-${driver.driverId}`, { text: notificationText, metadata: notificationMetadata });
      }
      await sendNotification({
        receiverIds: [driver.driverId],
        receiverType: "driver",
        text: notificationText,
        metadata: notificationMetadata,
      });
    }

    res.status(201).json({ message: "Booking created and drivers notified", bookingId, estimatedPrice });
  } catch (error) {
    console.error("Error booking cab:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Add a new cab
 */
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
      return res.status(401).json({ message: "Host not found" });
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
      message: "Cab added successfully",
      vehicleId,
    });
  } catch (error) {
    console.error("Error adding cab:", error.message);
    res.status(500).json({ message: "Error adding cab", error: error.message });
  }
};
async function estimatePrice({ origin, destination, vehicleId, trafficConditions }) {
  try {
    // Log the received input for debugging
    console.log("Estimating price with input:", { origin, destination, vehicleId, trafficConditions });

    // Validate input
    if (!origin || !destination || !vehicleId) {
      throw new Error("Missing required parameters: origin, destination, or vehicleId.");
    }
    if (!origin.latitude || !origin.longitude || !destination.latitude || !destination.longitude) {
      throw new Error("Invalid origin or destination coordinates.");
    }

    // Fetch distance and duration from Google Maps API
    const response = await axios.get(GOOGLE_MAPS_API_URL, {
      params: {
        origins: `${origin.latitude},${origin.longitude}`,
        destinations: `${destination.latitude},${destination.longitude}`,
        key: GOOGLE_MAPS_API_KEY,
        departure_time: "now", // Fetch real-time traffic data
      },
    });

    const { rows } = response.data;

    // Validate API response
    if (!rows || !rows[0].elements || rows[0].elements[0].status !== "OK") {
      console.error("Google Maps API response error:", response.data);
      throw new Error("Failed to fetch distance and duration from Google Maps.");
    }

    const { distance, duration } = rows[0].elements[0]; // Extract distance and duration
    const distanceInKm = distance.value / 1000; // Convert meters to kilometers
    const durationInMinutes = duration.value / 60; // Convert seconds to minutes

    // Fetch pricing from the database
    const pricing = await Pricing.findOne({ where: { vehicleid: vehicleId } });
    if (!pricing) {
      throw new Error("Pricing information not found for this vehicle.");
    }

    const costPerHr = pricing.costperhr || 0; // Base cost per hour
    const basePrice = distanceInKm * costPerHr; // Base price calculation

    // Initialize pricing multiplier
    let multiplier = 1.0;

    // Apply traffic multiplier
    if (trafficConditions === "HEAVY") {
      multiplier *= 1.3; // Increase price by 30% if traffic is heavy
    }

    // Apply night-time multiplier (22:00 - 06:00)
    const currentHour = new Date().getHours();
    if (currentHour >= 22 || currentHour < 6) {
      multiplier *= 1.1; // Increase price by 10% during night hours
    }

    const estimatedPrice = Math.round(basePrice * multiplier); // Calculate final price

    return {
      distance: distanceInKm,
      duration: durationInMinutes,
      estimatedPrice,
      multiplier,
      basePrice,
    };
  } catch (error) {
    console.error("Error estimating price:", error.message);
    throw new Error("Failed to estimate price.");
  }
}

module.exports = {
  searchForCabs,
  bookCab,
  addCab,
  estimatePrice,
};
