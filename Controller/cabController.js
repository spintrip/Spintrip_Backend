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
} = require("../Models");
const { sendNotification } = require("./adminController/notificationManagement");
const { publishMessage } = require("../Controller/pubsubController");
const sequelize = require("../Models").sequelize;
const { Op } = require("sequelize");
const { geolib } = require("geolib");

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
  const { latitude, longitude } = fromLocation;

  try {
    if (!fromLocation || !searchRadius) {
      return res.status(400).json({ message: "Missing required parameters: fromLocation or searchRadius" });
    }

    const currentTime = new Date();
    const minLatitude = latitude - searchRadius / 111;
    const maxLatitude = latitude + searchRadius / 111;
    const minLongitude = longitude - searchRadius / (111 * Math.cos(latitude * (Math.PI / 180)));
    const maxLongitude = longitude + searchRadius / (111 * Math.cos(latitude * (Math.PI / 180)));

    // Fetch active drivers within the radius
    const drivers = await sequelize.query(
      `
      SELECT d.id as driverId, va.latitude, va.longitude, va.address, dk.updatedAt as lastPing, d.deviceToken
      FROM VehicleAdditional va
      JOIN CabToDriver cd ON va.vehicleid = cd.vehicleid
      JOIN DriverKeepAlive dk ON cd.driverid = dk.driverid
      JOIN Driver d ON cd.driverid = d.id
      WHERE va.latitude BETWEEN :minLatitude AND :maxLatitude
        AND va.longitude BETWEEN :minLongitude AND :maxLongitude
        AND TIMESTAMPDIFF(MINUTE, dk.updatedAt, :currentTime) <= 5
      LIMIT 10
      `,
      {
        replacements: { minLatitude, maxLatitude, minLongitude, maxLongitude, currentTime },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    if (!drivers.length) {
      return res.status(404).json({ message: "No active drivers available within the specified radius." });
    }

    const nearbyDrivers = drivers.map((driver) => ({
      ...driver,
      distance: geolib.getDistance(
        { latitude, longitude },
        { latitude: driver.latitude, longitude: driver.longitude }
      ) / 1000, // Convert to kilometers
    }));

    res.status(200).json({
      message: "Nearby drivers found",
      nearbyDrivers,
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
  const { startLocation, endLocation, startDate, startTime } = req.body;
  const userId = req.user.id;

  try {
    const { distance } = await getDistanceAndDuration(startLocation, endLocation);

    const pricing = await Pricing.findOne({ where: { vehicleid: req.body.vehicleId } });
    if (!pricing) {
      return res.status(404).json({ message: "Pricing information not found for this vehicle." });
    }

    const amount = Math.round(distance * pricing.costperkm);
    const bookingId = uuid.v4();

    // Create the booking request
    await CabBookingRequest.create({
      bookingId,
      userId,
      startLocationLatitude: startLocation.latitude,
      startLocationLongitude: startLocation.longitude,
      endLocationLatitude: endLocation.latitude,
      endLocationLongitude: endLocation.longitude,
      estimate_price: amount,
      status: "pending",
    });

    // Notify drivers
    const notificationText = "New booking request nearby";
    const notificationMetadata = { bookingId, startLocation, endLocation, amount };

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

    res.status(201).json({ message: "Booking created and drivers notified", bookingId, amount });
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
    // Fetch distance and duration from Google Maps API
    const response = await axios.get(GOOGLE_MAPS_API_URL, {
      params: {
        origins: `${origin.latitude},${origin.longitude}`,
        destinations: `${destination.latitude},${destination.longitude}`,
        key: GOOGLE_MAPS_API_KEY,
        departure_time: "now", // Current time for traffic data
      },
    });

    const { rows } = response.data;
    if (!rows || rows[0].elements[0].status !== "OK") {
      throw new Error("Failed to fetch distance and duration from Google Maps.");
    }

    const { distance, duration, traffic_speed_entry } = rows[0].elements[0];
    const distanceInKm = distance.value / 1000; // Meters to Kilometers
    const durationInMinutes = duration.value / 60; // Seconds to Minutes

    // Get base pricing from the database
    const pricing = await Pricing.findOne({ where: { vehicleid: vehicleId } });
    if (!pricing) {
      throw new Error("Pricing information not found for this vehicle.");
    }

    const costPerHr = pricing.costperhr || 0; // Ensure costPerHr is defined
    const basePrice = distanceInKm * costPerHr;

    // Calculate multipliers based on traffic and night-time conditions
    let multiplier = 1.0;

    // Traffic-based pricing (if traffic_speed_entry or conditions indicate high traffic)
    if (trafficConditions || traffic_speed_entry === "HEAVY") {
      multiplier *= 1.3;
    }

    // Night-time pricing (22:00 - 06:00)
    const currentHour = new Date().getHours();
    if (currentHour >= 22 || currentHour < 6) {
      multiplier *= 1.1;
    }

    const estimatedPrice = Math.round(basePrice * multiplier);

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
