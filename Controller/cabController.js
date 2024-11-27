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
 * Driver Signup with OTP Verification
 */
const driverSignup = async (req, res) => {
  const { phone, name } = req.body;

  try {
    const hostId = req.user.id; // Get host ID from the authenticated token
    const host = await Host.findByPk(hostId);
    if (!host) return res.status(404).json({ message: "Host not found" });

    const existingDriver = await Driver.findOne({ where: { phone } });
    if (existingDriver) {
      return res.status(400).json({ message: "Driver already exists. Please log in." });
    }

    const driverId = uuid.v4();
    const otp = generateOTP();

    // Create driver with default password as `1234`
    await Driver.create({
      id: driverId,
      phone,
      name,
      hostid: hostId,
      otp,
      password: "1234",
    });

    sendOTP(phone, otp);
    res.status(201).json({ message: "Driver added. OTP sent for verification.", driverId });
  } catch (error) {
    console.error("Error during driver signup:", error.message);
    res.status(500).json({ message: "Error adding driver", error: error.message });
  }
};

/**
 * Driver OTP Verification
 */
const verifyDriverOtp = async (req, res) => {
  const { phone, otp } = req.body;

  try {
    const driver = await Driver.findOne({ where: { phone } });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    if (driver.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });

    const token = jwt.sign({ id: driver.id, role: "driver" }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.status(200).json({ message: "OTP verified successfully", token });
  } catch (error) {
    console.error("Error verifying OTP:", error.message);
    res.status(500).json({ message: "Error verifying OTP", error: error.message });
  }
};

/**
 * Driver Keep-Alive
 */
const driverKeepAlive = async (req, res) => {
  const { latitude, longitude } = req.body;
  const driverId = req.user.id;

  try {
    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Missing latitude or longitude" });
    }

    // Update driver's location
    const vehicleMapping = await CabToDriver.findOne({ where: { driverid: driverId } });
    if (!vehicleMapping) {
      return res.status(404).json({ message: "Driver is not assigned to a vehicle" });
    }

    await VehicleAdditional.update(
      { latitude, longitude },
      { where: { vehicleid: vehicleMapping.vehicleid } }
    );

    res.status(200).json({ message: "Location updated successfully" });
  } catch (error) {
    console.error("Error in keep-alive:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ======================= HOST CONTROLLER FUNCTIONS =======================

/**
 * Add Driver
 */
const addDriver = async (req, res) => {
  const { name, phone } = req.body;
  const hostId = req.user.id;

  try {
    const driverId = uuid.v4();
    const otp = generateOTP();

    await Driver.create({
      id: driverId,
      hostid: hostId,
      name,
      phone,
      otp,
      password: "1234",
    });

    sendOTP(phone, otp);
    res.status(201).json({ message: "Driver added. OTP sent for verification.", driverId });
  } catch (error) {
    console.error("Error adding driver:", error.message);
    res.status(500).json({ message: "Error adding driver", error: error.message });
  }
};

/**
 * Assign Driver to Vehicle
 */
const assignDriverToVehicle = async (req, res) => {
  const { driverId, vehicleId } = req.body;
  const hostId = req.user.id;

  try {
    const driver = await Driver.findOne({ where: { id: driverId, hostid: hostId } });
    if (!driver) return res.status(404).json({ message: "Driver not found or unauthorized" });

    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleId, hostId } });
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found or unauthorized" });

    await CabToDriver.upsert({ driverid: driverId, vehicleid: vehicleId, assignedAt: new Date() });

    res.status(200).json({ message: "Driver assigned to vehicle successfully" });
  } catch (error) {
    console.error("Error assigning driver:", error.message);
    res.status(500).json({ message: "Error assigning driver", error: error.message });
  }
};

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

    // Fetch vehicles with updated locations within the last 5 minutes
    const fiveMinutesAgo = new Date(new Date() - 5 * 60 * 1000);

    const vehicles = await VehicleAdditional.findAll({
      attributes: ['vehicleid', 'latitude', 'longitude', 'address'],
      where: {
        latitude: { [Op.between]: [minLatitude, maxLatitude] },
        longitude: { [Op.between]: [minLongitude, maxLongitude] },
        timestamp: { [Op.gte]: fiveMinutesAgo }, // Filter by last updated timestamp
      },
    });

    if (!vehicles.length) {
      return res.status(404).json({ message: "No active vehicles found within the specified radius." });
    }

    // Filter vehicles by precise distance
    const nearbyVehicles = vehicles
      .map((vehicle) => {
        const distance = geolib.getPreciseDistance(
          { latitude, longitude },
          { latitude: vehicle.latitude, longitude: vehicle.longitude }
        ) / 1000; // Convert meters to kilometers

        return {
          vehicleId: vehicle.vehicleid,
          address: vehicle.address,
          latitude: vehicle.latitude,
          longitude: vehicle.longitude,
          distance,
        };
      })
      .filter((vehicle) => vehicle.distance <= searchRadius);

    if (!nearbyVehicles.length) {
      return res.status(404).json({ message: "No vehicles available within the specified radius." });
    }

    res.status(200).json({
      message: "Nearby vehicles found",
      nearbyVehicles,
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

    //for (const driver of drivers.nearbyDrivers) {
    //  if (driver.deviceToken) {
    //    await publishMessage(`driver-${driver.driverId}`, { text: notificationText, metadata: notificationMetadata });
    //  }
    //  await sendNotification({
    //    receiverIds: [driver.driverId],
    //    receiverType: "driver",
    //    text: notificationText,
    //    metadata: notificationMetadata,
    //  });
    //}

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
    costperkm, // Add costperkm to the request body
  } = req.body;

  try {
    // Validate host
    const host = await Host.findByPk(req.user.id);
    if (!host) {
      return res.status(401).json({ message: "Host not found" });
    }

    // Generate vehicle ID
    const vehicleId = uuid.v4();

    // Create Vehicle entry
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

    // Create VehicleAdditional entry
    await VehicleAdditional.create({
      vehicleid: vehicleId,
      latitude,
      longitude,
      address,
    });

    // Create Cab entry
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

    // Validate and Create Pricing entry
    if (!costperkm || costperkm <= 0) {
      return res.status(400).json({ message: "Invalid cost per km. Please provide a positive value." });
    }

    await Pricing.create({
      vehicleid: vehicleId,
      costperhr: costperkm, // Save costperkm as costperhr
    });

    // Create Listing entry
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

    const { distance, duration } = rows[0].elements[0];
    const distanceInKm = distance.value / 1000; // Convert meters to kilometers
    const durationInMinutes = duration.value / 60; // Convert seconds to minutes

    // Fetch pricing from the database
    const pricing = await Pricing.findOne({ where: { vehicleid: vehicleId } });
    if (!pricing) {
      throw new Error("Pricing information not found for this vehicle.");
    }

    const costPerKm = pricing.costperhr || 20; // Use costperhr field as cost per km
    const basePrice = distanceInKm * costPerKm; // Base price calculation

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

const updateDriverDeviceToken = async (req, res) => {
  try {
    const driverId = req.user.id; // Extract driver ID from authenticated user
    const { deviceToken } = req.body; // Get device token from the request body

    if (!deviceToken) {
      return res.status(400).json({ message: "Device token is required" });
    }

    // Find the driver and update the device token
    const driver = await Driver.findByPk(driverId);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    await driver.update({ deviceToken });

    res.status(200).json({ message: "Device token updated successfully" });
  } catch (error) {
    console.error("Error updating driver device token:", error.message);
    res.status(500).json({ message: "Error updating device token", error: error.message });
  }
};
module.exports = {
  searchForCabs,
  bookCab,
  addCab,
  estimatePrice,
  driverSignup,
  verifyDriverOtp,
  driverKeepAlive,
  addDriver,
  assignDriverToVehicle,
  updateDriverDeviceToken
};
