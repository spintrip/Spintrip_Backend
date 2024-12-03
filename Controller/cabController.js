const axios = require("axios");
const jwt = require('jsonwebtoken');
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
} = require("../Models");
const sequelize = require("../Models").sequelize;
const { Op } = require("sequelize");
const geolib = require("geolib");
const { sendOTP, generateOTP } = require('./hostcontroller/hostBooking');

// Google Maps API Configuration
const GOOGLE_MAPS_API_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

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

    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({ message: "Invalid latitude" });
    }
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ message: "Invalid longitude" });
    }

    const vehicleMapping = await CabToDriver.findOne({ where: { driverid: driverId } });
    if (!vehicleMapping) {
      return res.status(404).json({ message: "Driver is not assigned to a vehicle" });
    }

    await VehicleAdditional.update(
      { latitude: parseFloat(latitude), longitude: parseFloat(longitude), timestamp: new Date() },
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
  const driver = await Driver.findOne({ where: { phone: phone } });
  if(driver){
    res.status(500).json({ message: "Driver already exists, please assign the driver."});
  }
  try {
    const driverId = uuid.v4();
    const otp = generateOTP();

    const driver = await Driver.create({
      id: driverId,
      hostid: hostId,
      name,
      phone,
      otp,
      password: "1234",
    });
    console.log(driver)
    sendOTP(phone, otp);
    res.status(201).json({ message: "Driver added. OTP sent for verification.", driver });
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

    const fiveMinutesAgo = new Date(new Date() - 5 * 60 * 1000);

    // PostGIS spatial query
    const nearbyVehicles = await VehicleAdditional.findAll({
      attributes: [
        'vehicleid',
        'latitude',
        'longitude',
        [
          sequelize.literal(
            `ST_Distance(
              geography(location),
              geography(ST_MakePoint(${longitude}, ${latitude}))
            ) / 1000`
          ),
          'distance', // Distance in kilometers
        ],
      ],
      include: [
        {
          model: CabToDriver,
          attributes: ['driverid'],
          required: true, // Ensure the vehicle has a driver assigned
        },
      ],
      where: {
        timestamp: { [Op.gte]: fiveMinutesAgo },
        [Op.and]: sequelize.literal(
          `ST_DWithin(
            geography(location),
            geography(ST_MakePoint(${longitude}, ${latitude})),
            ${searchRadius * 1000}
          )`
        ),
      },
      order: [[sequelize.literal('distance'), 'ASC']],
    });

    if (!nearbyVehicles.length) {
      return res.status(404).json({ message: "No active vehicles found within the specified radius." });
    }

    res.status(200).json({
      message: "Nearby vehicles found",
      nearbyVehicles: nearbyVehicles.map((vehicle) => ({
        vehicleId: vehicle.vehicleid,
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
        distance: parseFloat(vehicle.get('distance')), // Sequelize raw attribute
      })),
    });
  } catch (error) {
    console.error("Error searching for cabs:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Book a cab and notify nearby drivers
 */
const bookCab = async (req, res) => {
  const { startLocation, endLocation, startDate, startTime, vehicleId } = req.body;
  const userId = req.user.id
  try {
    // Validate input
    if (!startLocation || !endLocation || !vehicleId) {
      return res.status(400).json({ message: "Missing required parameters." });
    }

    // Estimate price internally
    const { estimatedPrice } = await estimatePrice({
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
      vehicletype: "3",
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

const login = async (req, res) => {
  const { phone } = req.body;

  try {
    const driver = await Driver.findOne({ where: { phone } });
    if (!driver) return res.status(404).json({ message: 'Driver not found. Please sign up.' });

    const otp = generateOTP();
    await driver.update({ otp });

    sendOTP(phone, otp);
    res.status(200).json({ message: 'OTP sent successfully to the provided phone number.', otp:otp });
  } catch (error) {
    console.error('Error during driver login:', error);
    res.status(500).json({ message: 'Error during login', error });
  }
};
/**
 * Estimate price using Google Maps API for distance and traffic conditions
 */
const estimatePrice = async ({ origin, destination, vehicleId }) => {
  try {
    console.log("Estimating price with input:", { origin, destination, vehicleId });

    // Validate input
    if (!origin || !destination || !vehicleId) {
      throw new Error("Missing required parameters: origin, destination, or vehicleId.");
    }
    if (!origin.latitude || !origin.longitude || !destination.latitude || !destination.longitude) {
      throw new Error("Invalid origin or destination coordinates.");
    }

    // Fetch distance, duration, and traffic information from Google Maps API
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

    // Fetch pricing information for the vehicle
    const pricing = await Pricing.findOne({ where: { vehicleid: vehicleId } });
    if (!pricing) {
      throw new Error("Pricing information not found for this vehicle.");
    }

    const costPerKm = pricing.costperhr || 20; // Use costperhr as cost per km
    const basePrice = distanceInKm * costPerKm; // Base price calculation

    // Initialize pricing multiplier
    let multiplier = 1.0;

    // Determine traffic conditions based on duration-to-distance ratio
    const trafficRatio = durationInMinutes / distanceInKm; // Average time per kilometer
    if (trafficRatio > 2.5) {
      multiplier *= 1.3; // Heavy traffic increases price by 30%
    } else if (trafficRatio > 1.5) {
      multiplier *= 1.1; // Moderate traffic increases price by 10%
    }

    // Apply night-time multiplier (22:00 - 06:00)
    const currentHour = new Date().getHours();
    if (currentHour >= 22 || currentHour < 6) {
      multiplier *= 1.1; // Increase price by 10% during night hours
    }

    const estimatedPrice = Math.round(basePrice * multiplier); // Final price calculation

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
};

const getEstimate =  async (req, res) => {
  try {
    // Extract data from the request body
    const { origin, destination, vehicleId, trafficConditions } = req.body;

    // Validate the input
    if (!origin || !destination || !vehicleId) {
      return res.status(400).json({ message: "Missing required parameters: origin, destination, or vehicleId." });
    }

    // Call the estimatePrice function with the required parameters
    const result = await estimatePrice({ origin, destination, vehicleId, trafficConditions });

    // Return the result to the client
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in /get-estimate route:", error.message);
    res.status(500).json({ message: "Failed to estimate price.", error: error.message });
  }
};

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
const getDriver = async (req, res) => {
  const hostId = req.user.id;

  try {
    const drivers = await Driver.findAll({ where: { hostid: hostId } });
    res.status(200).json({ drivers });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ message: 'Error fetching drivers', error });
  }
}

/**
 * Create a soft booking and notify nearby drivers
 */
const createSoftBooking = async (req, res) => {
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

    // Create a soft booking entry in the database
    await CabBookingRequest.create({
      bookingId,
      userId,
      vehicleId,
      startLocationLatitude: startLocation.latitude,
      startLocationLongitude: startLocation.longitude,
      endLocationLatitude: endLocation.latitude,
      endLocationLongitude: endLocation.longitude,
      estimate_price: estimatedPrice,
      status: "soft_booked", // Soft booking status
    });

    // Search for nearby cabs
    const driversResponse = await searchForCabs({ body: { fromLocation: startLocation, searchRadius: 5 } });

    if (driversResponse.status !== 200 || !driversResponse.nearbyVehicles) {
      return res.status(404).json({ message: "No drivers available nearby." });
    }

    const nearbyDrivers = driversResponse.nearbyVehicles.map((vehicle) => vehicle.driverid);

    // Notify drivers asynchronously
    for (const driverId of nearbyDrivers) {
      await notifyDriver(driverId, bookingId);
    }

    res.status(201).json({
      message: "Soft booking created. Waiting for driver to accept.",
      bookingId,
      estimatedPrice,
    });
  } catch (error) {
    console.error("Error creating soft booking:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Notify a driver about a booking
 */
async function notifyDriver(driverId, bookingId) {
  try {
    // Simulate sending a notification (replace with actual notification logic)
    const notification = {
      text: "New booking request nearby",
      metadata: { bookingId },
    };
    console.log(`Notifying driver ${driverId}:`, notification);

    // Example: Publish notification to a message broker or push notification service
    // await publishMessage(`driver-${driverId}`, notification);

    return true;
  } catch (error) {
    console.error(`Error notifying driver ${driverId}:`, error.message);
    return false;
  }
}

/**
 * Accept a soft booking
 */
const acceptBooking = async (req, res) => {
  const { bookingId } = req.body;
  const driverId = req.user.id; // Assuming driver's identity is verified through JWT or similar

  try {
    // Fetch the soft booking
    const booking = await CabBookingRequest.findOne({ where: { bookingId, status: "soft_booked" } });
    if (!booking) {
      return res.status(404).json({ message: "Soft booking not found or already taken." });
    }

    // Update soft booking to confirmed
    await CabBookingRequest.update(
      { status: "confirmed", driverId },
      { where: { bookingId } }
    );

    // Generate an OTP for the trip
    const tripOtp = generateOTP();

    // Save the confirmed booking in `Booking` table
    const newBooking = await Booking.create({
      Bookingid: bookingId,
      Date: new Date(),
      vehicleid: booking.vehicleId,
      id: booking.userId,
      status: 1, // 1 indicates "confirmed"
      amount: booking.estimate_price,
      startTripDate: new Date(),
    });

    // Save the confirmed booking details
    await CabBookingAccepted.create({
      bookingId,
      driverId,
      userId: booking.userId,
      tripOtp,
    });

    // Notify the user (replace with actual notification logic)
    console.log(`Notifying user ${booking.userId}: Booking confirmed with OTP ${tripOtp}`);

    res.status(200).json({
      message: "Booking accepted successfully",
      bookingId,
      tripOtp,
      booking: newBooking,
    });
  } catch (error) {
    console.error("Error accepting booking:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const checkBookingStatus = async (req, res) => {
  const { bookingId } = req.params;

  try {
    const booking = await CabBookingRequest.findOne({
      where: { bookingId },
      include: [{ model: CabBookingAccepted, attributes: ["tripOtp"] }],
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    res.status(200).json({
      status: booking.status,
      driverId: booking.driverId || null,
      tripOtp: booking.CabBookingAccepted?.tripOtp || null,
    });
  } catch (error) {
    console.error("Error checking booking status:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
const checkPendingBookings = async (req, res) => {
  const driverId = req.user.id; // Driver's ID from JWT authentication

  try {
    // Fetch all pending bookings where the driver has not yet accepted
    const pendingBookings = await CabBookingRequest.findAll({
      where: { status: "soft_booked", driverId: null },
    });

    if (!pendingBookings.length) {
      return res.status(404).json({ message: "No pending bookings found." });
    }

    res.status(200).json({
      message: "Pending bookings found.",
      bookings: pendingBookings,
    });
  } catch (error) {
    console.error("Error fetching pending bookings:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
const endTrip = async (req, res) => {
  const { bookingId } = req.body;
  const driverId = req.user.id;

  const transaction = await sequelize.transaction(); // Start a transaction
  try {
    // Fetch the confirmed booking
    const booking = await Booking.findOne({
      where: { Bookingid: bookingId, status: 1 }, // status 1 = confirmed
      transaction,
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found or already completed." });
    }

    // Validate that the driver is authorized for this booking
    const assignedDriver = await CabToDriver.findOne({
      where: { driverid: driverId, vehicleid: booking.vehicleid },
      transaction,
    });

    if (!assignedDriver) {
      return res.status(403).json({ message: "Driver not authorized for this booking." });
    }

    // Fetch the soft booking details to get the drop location
    const softBooking = await CabBookingRequest.findOne({
      where: { bookingId },
      attributes: ["endLocationLatitude", "endLocationLongitude"],
      transaction,
    });

    if (!softBooking) {
      return res.status(404).json({ message: "Soft booking not found for this trip." });
    }

    const { endLocationLatitude, endLocationLongitude } = softBooking;
    if (!endLocationLatitude || !endLocationLongitude) {
      return res.status(400).json({ message: "Invalid or missing drop location in soft booking." });
    }

    // Fetch the vehicle's current location
    const vehicle = await VehicleAdditional.findOne({
      where: { vehicleid: booking.vehicleid },
      attributes: ["latitude", "longitude"],
      transaction,
    });

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle location not found." });
    }

    // Calculate the distance between the vehicle's current location and the drop location
    const distance = geolib.getDistance(
      { latitude: vehicle.latitude, longitude: vehicle.longitude },
      { latitude: endLocationLatitude, longitude: endLocationLongitude }
    ) / 1000; // Convert meters to kilometers

    // Ensure the vehicle is within 0.5 km of the drop location to allow ending the trip
    if (distance > 0.5) {
      return res.status(400).json({ message: "Vehicle is not near the drop location." });
    }

    // Update the booking as completed
    await Booking.update(
      {
        status: 2, // 2 = completed
        endTripDate: new Date(),
        endTripTime: new Date(),
      },
      { where: { Bookingid: bookingId }, transaction }
    );

    // Remove the soft booking entry
    await CabBookingRequest.destroy({ where: { bookingId }, transaction });

    await transaction.commit(); // Commit the transaction
    res.status(200).json({
      message: "Trip ended successfully.",
      bookingId,
    });
  } catch (error) {
    await transaction.rollback(); // Rollback the transaction on error
    console.error("Error ending trip:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  searchForCabs,
  bookCab,
  addCab,
  getEstimate,
  verifyDriverOtp,
  driverKeepAlive,
  addDriver,
  assignDriverToVehicle,
  updateDriverDeviceToken,
  login,
  getDriver,
  checkBookingStatus,
  acceptBooking,
  createSoftBooking,
  checkPendingBookings,
  endTrip
};
