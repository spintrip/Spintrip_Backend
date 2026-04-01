const axios = require("axios");
const jwt = require('jsonwebtoken');
const uuid = require("uuid");
const {
  User,
  Host,
  Vehicle,
  VehicleAdditional,
  Cab,
  Pricing,
  Listing,
  CabBookingRequest,
  CabBookingAccepted,
  Driver,
  DriverAdditional,
  CabToDriver,
  Wallet,
  WalletTransaction,
  HostCabRateCard,
  City,
  Tax,
  ReferralReward,
} = require("../Models");
const sequelize = require("../Models").sequelize;
const { Op } = require("sequelize");
const geolib = require("geolib");
const { sendOTP, generateOTP } = require('./hostcontroller/hostBooking');
const { sendPushNotification } = require('../Utils/notificationService');

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
 * Toggle Driver Online/Offline status
 */
const toggleDriverStatus = async (req, res) => {
  const driverId = req.user.id;
  try {
    const driver = await Driver.findByPk(driverId);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    // Toggle the boolean value
    driver.isActive = !driver.isActive;
    await driver.save();

    res.status(200).json({
      message: `Driver status updated successfully`,
      isActive: driver.isActive
    });
  } catch (error) {
    console.error("Error toggling driver status:", error.message);
    res.status(500).json({ message: "Error toggling driver status", error: error.message });
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

    const vehicleMapping = await Cab.findOne({ where: { driverId: driverId } });
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
  const t = await sequelize.transaction();

  try {
    if (req.user.role === 'admin') {
      let hostCheck = await Host.findByPk(hostId, { transaction: t });
      if (!hostCheck) {
        await Host.create({ id: hostId }, { transaction: t });
      }
    }

    // Check if user already exists
    let user = await User.findOne({ where: { phone: phone }, transaction: t });
    let driverId;

    if (user) {
      // If user exists, check if they are already acting as a driver
      const existingDriver = await Driver.findByPk(user.id, { transaction: t });
      if (existingDriver) {
        await t.rollback();
        return res.status(400).json({ message: "Driver profile already exists for this phone number." });
      }
      driverId = user.id;
    } else {
      driverId = uuid.v4();
      const otp = generateOTP();

      // 1. Create User Identity
      user = await User.create({
        id: driverId,
        phone,
        password: "1234",
        otp,
        role: "driver"
      }, { transaction: t });

      // Send OTP to the new phone
      sendOTP(phone, otp);
    }

    // 2. Create nested Driver Identity
    const driver = await Driver.create({
      id: driverId,
      hostid: hostId,
      isActive: false
    }, { transaction: t });

    // 3. Create nested Driver Additional info (name, etc)
    await DriverAdditional.create({
      id: driverId,
      FullName: name
    }, { transaction: t });

    await t.commit();
    res.status(201).json({ message: "Driver identity established successfully.", driverId });

  } catch (error) {
    await t.rollback();
    console.error("Error adding driver:", error.message);
    res.status(500).json({ message: "Error adding driver", error: error.message });
  }
};

/**
 * Assign Driver to Vehicle
 */
const assignDriverToVehicle = async (req, res) => {
  const driverId = req.body.driverId || req.body.driverid;
  const vehicleId = req.body.vehicleId || req.body.vehicleid;
  const hostId = req.user.id;

  if (req.user.role === 'admin') {
    let hostCheck = await Host.findByPk(hostId);
    if (!hostCheck) {
      await Host.create({ id: hostId });
    }
  }

  try {
    const driver = await Driver.findOne({ where: { id: driverId, hostid: hostId } });
    if (!driver) return res.status(404).json({ message: "Driver not found or unauthorized" });

    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleId, hostId } });
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found or unauthorized" });

    await Cab.update({ driverId: driverId }, { where: { vehicleid: vehicleId } });

    res.status(200).json({ message: "Driver assigned to vehicle successfully" });
  } catch (error) {
    console.error("Error assigning driver:", error.message);
    res.status(500).json({ message: "Error assigning driver", error: error.message });
  }
};

/**
 * Search for nearby cabs
 */

// const estimatePrice = async ({ origin, destination, vehicleId, cabType = "mini cab", bookingType = "Local", address = "" }) => {

//   try {

//     if (!origin) {
//       throw new Error("Missing parameters");
//     }

//     console.log("Estimating price with origin:", origin, "destination:", destination, "vehicleId:", vehicleId, "cabType:", cabType, "bookingType:", bookingType);

//     let distanceKm = 0;
//     let durationMin = 0;

//     try {
//       let originLat, originLng;
//       let destLat, destLng;

//       if (typeof origin === "string") {
//         const parts = origin.split(",");
//         originLat = parseFloat(parts[0]);
//         originLng = parseFloat(parts[1]);
//       } else {
//         originLat = parseFloat(origin.latitude);
//         originLng = parseFloat(origin.longitude);
//       }

//       if (typeof destination === "string") {
//         const parts = destination.split(",");
//         destLat = parseFloat(parts[0]);
//         destLng = parseFloat(parts[1]);
//       } else {
//         destLat = parseFloat(destination.latitude);
//         destLng = parseFloat(destination.longitude);
//       }

//       console.log("Parsed coordinates:", {
//         originLat,
//         originLng,
//         destLat,
//         destLng
//       });

//       const url =
//         `https://maps.googleapis.com/maps/api/distancematrix/json` +
//         `?origins=${originLat},${originLng}` +
//         `&destinations=${destLat},${destLng}` +
//         `&departure_time=now` +
//         `&units=metric` +
//         `&key=${GOOGLE_MAPS_API_KEY}`;

//       console.log("Google Request URL:", url);

//       const response = await axios.get(url);

//       console.log("Google Response:", response.data);
//       console.log("Google Maps API response:", response.data);

//       const element = response.data?.rows?.[0]?.elements?.[0];
//       console.log("Distance Matrix element:", element);
//       // if (!element || element.status !== "OK") {
//       //   throw new Error("Google distance error");
//       // }

//       distanceKm = element.distance.value / 1000;
//       durationMin = element.duration.value / 60;

//     } catch (googleError) {

//       console.log("Google API failed, using haversine distance");

//       distanceKm = haversineDistance(
//         origin.latitude,
//         origin.longitude,
//         destination.latitude,
//         destination.longitude
//       );

//       durationMin = distanceKm * 2; // assume avg 30km/h

//     }

//     /// NEW DYNAMIC PRICING MATH VIA HOSTCABRATECARD
//     let subtotalBasePrice = 0;

//     // Find all rate cards for this Cab Type (Case-Insensitive match)
//     const rateCards = await HostCabRateCard.findAll({
//        where: { 
//          cabType: { [Op.iLike]: (cabType.trim() || "Mini") } 
//        },
//        order: [['createdAt', 'DESC']]
//     });

//     let rateCard = null;
//         // Use the Smart City Matcher instead of the old address check
//     const matchedCity = await getMatchedOperationalCity(address, req?.body?.city);

//     if (matchedCity) {
//        const matchedCards = rateCards.filter(rc => {
//          if (!rc.city) return false;
//          // Match the rate card ONLY to the city found in your 'City' table
//          return rc.city.toLowerCase() === matchedCity.toLowerCase();
//        });
//        if (matchedCards.length > 0) rateCard = matchedCards[0];
//     }
//  else {
//        // Old fallback logic if no address is provided (global search)
//        if (rateCards.length > 0) rateCard = rateCards[0];
//     }

//     if (rateCard) {
//       if (bookingType === 'Airport') {
//          subtotalBasePrice = rateCard.airportTransferPrice || 1200;
//          distanceKm = 30; durationMin = 60; // display defaults
//       } else if (bookingType === 'Rentals') {
//          subtotalBasePrice = rateCard.fullDayPrice || 2500;
//          distanceKm = 80; durationMin = 480; 
//       } else if (bookingType === 'Outstation') {
//          const driverAllowance = rateCard.driverAllowancePerDay || 300;
//          subtotalBasePrice = (300 * (rateCard.outstationPerKmPrice || 20)) + driverAllowance;
//          distanceKm = 300; durationMin = 1440;
//       } else {
//          // Daily (Generic Point to point mapping)
//          // Assuming halfDayPrice mapped roughly to base
//          subtotalBasePrice = distanceKm * (rateCard.outstationPerKmPrice || 15);
//       }
//     } else {
//         // Stop generating fake generic rates. If the local Admin didn't add it, it shouldn't exist.
//         return { estimatedPrice: null, message: `No rate cards active for ${cabType} in your city.` };
//     }

//     /// APPLY CAB RATE CARD MULTIPLIERS, TRAFFIC/SURGE & TOLLS
//     const ratio = distanceKm > 0 ? durationMin / distanceKm : 0;
//     let trafficMultiplier = ratio > 2.5 ? 1.3 : (ratio > 1.5 ? 1.1 : 1);

//     let hostSurgeMultiplier = rateCard ? (rateCard.surgeMultiplier || 1.0) : 1.0;
//     let flatTollCharges = rateCard ? (rateCard.tollCharges || 0.0) : 0.0;

//     // Minimum Subtotal + Dynamic Surge Multipliers + Static Tolls
//     subtotalBasePrice = Math.max(Math.round((subtotalBasePrice * trafficMultiplier * hostSurgeMultiplier) + flatTollCharges), 100);

//     /// NEW FEE CALCULATION ACCORDING TO USER FORMULA
//     // Base Price here is the TOTAL amount shown to the user (including GST)
//     const basePriceTotal = subtotalBasePrice; // Initial subtotal after surge/tolls

//     // 1. Remove 5% GST to get Net Base
//     const netBase = basePriceTotal / 1.05;

//     // 2. Calculate 20% Commission on Net Base
//     const commissionAmount = netBase * 0.20;

//     // 3. Earnings before TDS = Net Base - Commission
//     const earningsBeforeTDS = netBase - commissionAmount;

//     // 4. Calculate 1% TDS ON EARNINGS (as requested)
//     const tdsAmount = earningsBeforeTDS * 0.01;

//     // 5. Final Driver Earnings = Earnings Before TDS - TDS
//     const driverEarnings = earningsBeforeTDS - tdsAmount;

//     // 6. Confirmation Fee = Base Price Total - Driver Earnings
//     const confirmationFeeAmount = basePriceTotal - driverEarnings;

//     // Tax Breakdown for display
//     const gstAmount = basePriceTotal - netBase;

//     return {
//       distance: distanceKm,
//       duration: durationMin,
//       subtotalBasePrice: Math.round(netBase * 100) / 100,
//       gstAmount: Math.round(gstAmount * 100) / 100,
//       estimatedPrice: Math.round(basePriceTotal * 100) / 100,
//       commissionAmount: Math.round(commissionAmount * 100) / 100,
//       tdsAmount: Math.round(tdsAmount * 100) / 100,
//       confirmationFee: Math.round(confirmationFeeAmount * 100) / 100,
//       driverEarnings: Math.round(driverEarnings * 100) / 100,
//     };

//   } catch (err) {
//     console.error("Error estimating price:", err.message);

//     // Default 100 Rs logic
//     const fallbackBase = 100;
//     const gstFallback = 5;
//     return {
//       distance: 0,
//       duration: 0,
//       subtotalBasePrice: fallbackBase,
//       gstAmount: gstFallback,
//       estimatedPrice: fallbackBase + gstFallback,
//       commissionAmount: 20,
//       tdsAmount: 1,
//       driverEarnings: 79 // 100 - 20 - 1
//     };
//   }

// };
const haversineDistance = (lat1, lon1, lat2, lon2) => {

  const R = 6371;

  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};
const searchForCabs = async (req, res) => {
  const { fromLocation, searchRadius, cabType } = req.body;

  try {
    if (!fromLocation || !searchRadius) {
      return res.status(400).json({ message: "Missing required parameters: fromLocation or searchRadius" });
    }

    const { latitude, longitude } = fromLocation;
    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Invalid location coordinates." });
    }

    const fiveMinutesAgo = new Date(new Date() - 5 * 60 * 1000);

    const vehicleInclude = cabType ? {
      model: Vehicle,
      required: true,
      include: [{
        model: Cab,
        required: true,
        where: { type: cabType },
        attributes: ['driverId', 'type'],
        include: [{
          model: Driver,
          required: true,
          where: { isActive: true }
        }]
      }]
    } : {
      model: Vehicle,
      required: true,
      include: [{
        model: Cab,
        required: true,
        attributes: ['driverId', 'type'],
        include: [{
          model: Driver,
          required: true,
          where: { isActive: true }
        }]
      }]
    };

    // PostGIS spatial query
    const nearbyVehicles = await VehicleAdditional.findAll({
      attributes: [
        'vehicleid',
        'latitude',
        'longitude',
        [
          sequelize.literal(
            `(6371 * acos(least(1.0, cos(radians(${latitude})) * cos(radians("VehicleAdditional"."latitude")) * cos(radians("VehicleAdditional"."longitude") - radians(${longitude})) + sin(radians(${latitude})) * sin(radians("VehicleAdditional"."latitude")))))`
          ),
          'distance', // Distance in kilometers
        ],
      ],
      include: [vehicleInclude],
      where: {
        timestamp: { [Op.gte]: fiveMinutesAgo },
        [Op.and]: sequelize.literal(
          `(6371 * acos(least(1.0, cos(radians(${latitude})) * cos(radians("VehicleAdditional"."latitude")) * cos(radians("VehicleAdditional"."longitude") - radians(${longitude})) + sin(radians(${latitude})) * sin(radians("VehicleAdditional"."latitude"))))) <= ${searchRadius}`
        ),
      },
      order: [[sequelize.literal('distance'), 'ASC']],
    });

    if (!nearbyVehicles.length) {
      return res.status(404).json({ message: "No active vehicles found within the specified radius for this category." });
    }

    res.status(200).json({
      message: "Nearby vehicles found",
      nearbyVehicles: nearbyVehicles.map((vehicle) => ({
        vehicleId: vehicle.vehicleid,
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
        distance: parseFloat(vehicle.get('distance')), // Sequelize raw attribute
        cabType: vehicle.Vehicle?.Cab?.type
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
  const { startLocation, endLocation, startDate, startTime, vehicleId, cabType, bookingType, estimatedPrice: reqEstimatedPrice } = req.body;
  const userId = req.user.id;
  try {
    // Validate input (Rentals don't need an end location)
    if (!startLocation || (!endLocation && bookingType !== 'Rentals')) {
      return res.status(400).json({ message: "Missing required parameters." });
    }

    let estimatedPrice = reqEstimatedPrice;
    let originalEstimatedPrice = estimatedPrice;
    let confirmationFeeAmount = 0;
    let payToDriverAmount = 0;

    // Helper to calculate segregated amounts based on a price
    const calculateSegregation = (totalPrice) => {
      const netBase = totalPrice / 1.05;
      const commissionAmount = netBase * 0.20;
      const tdsAmount = netBase * 0.01; // 1% of Gross Amount (excluding GST) as per Section 194-O
      const driverPay = Math.round((netBase - commissionAmount - tdsAmount) * 100) / 100;
      const platformFee = Math.round((totalPrice - driverPay) * 100) / 100;
      return { driverPay, platformFee };
    };

    if (estimatedPrice) {
      // 1. Always calculate the DRIVER'S SHARE based on the Original Price for protection
      const originalBreakdown = calculateSegregation(estimatedPrice);
      payToDriverAmount = originalBreakdown.driverPay;
      confirmationFeeAmount = originalBreakdown.platformFee;
    } else {
      // Fallback estimate price internally
      const estimate = await estimatePrice({
        origin: startLocation,
        destination: endLocation || startLocation,
        vehicleId,
        cabType,
        bookingType,
        address: startLocation.address || ""
      });
      estimatedPrice = estimate.estimatedPrice;
      originalEstimatedPrice = estimatedPrice;
      payToDriverAmount = estimate.driverEarnings;
      confirmationFeeAmount = estimate.confirmationFee;
    }

    if (!estimatedPrice || !confirmationFeeAmount) {
      return res.status(500).json({ message: "Failed to estimate price or calculate confirmation fee." });
    }

    const bookingId = uuid.v4();

    const t = await sequelize.transaction();

    try {
      // --- GOLD COIN (REFERRAL) USAGE ---
      // Platform Subsidy Mode: User gets ₹100 off, Driver gets full share, Platform absorbs the difference.
      if (req.body.useReferralCoins) {
          const userWallet = await Wallet.findOne({ 
            where: { userId }, 
            transaction: t,
            lock: t.LOCK.UPDATE // Lock for atomic balance check
          });

          // Usage Cap: Strictly limit to 100 coins per booking
          if (userWallet && userWallet.balance >= 100) {
              const maxDiscountPossible = 100.0;
              
              // 🛡️ SAFETY FLOOR: User must pay at least (DriverPay + GST + TDS)
              // Taxes on collected amount X = X * (0.05 + 0.01) / 1.05 = X * 0.06 / 1.05
              // Remaining for platform = X - Taxes. We want X - Taxes >= payToDriverAmount
              // X * (1 - 0.06/1.05) >= payToDriverAmount => X * (0.99/1.05) >= payToDriverAmount
              // X >= payToDriverAmount * (1.05 / 0.99)
              const minUserPayment = Math.round((payToDriverAmount * (1.05 / 0.99)) * 100) / 100;
              const allowedDiscount = Math.floor(Math.min(maxDiscountPossible, originalEstimatedPrice - minUserPayment));

              if (allowedDiscount > 0) {
                  // 1. Reduce the price shown to the user
                  estimatedPrice = Math.max(0, originalEstimatedPrice - allowedDiscount);
                  
                  // 2. Reduce the platform's confirmation fee (subsidy)
                  // Note: payToDriverAmount remains unchanged (Calculated on original fare above)
                  confirmationFeeAmount = Math.round((estimatedPrice - payToDriverAmount) * 100) / 100;

                  // 3. Deduct from Wallet
                  await userWallet.decrement('balance', { by: allowedDiscount, transaction: t });

                  // 4. Log Transaction
                  await WalletTransaction.create({
                      id: uuid.v4(),
                      walletId: userWallet.id,
                      amount: allowedDiscount,
                      type: 'DEBIT',
                      description: 'Ride Discount: Gold Coins Used',
                      referenceId: bookingId
                  }, { transaction: t });

                  console.log(`User ${userId} applied ${allowedDiscount} Gold Coins for booking ${bookingId} (Safety Cap Active)`);
              }
          }
      }
      // --------------------------

      // Note: Backend wallet checks and debits are now removed for cab bookings.
      // Confirmation fee (26%) is handled via payroll/external payment.

      // let dbCabType = cabType;
      // if (dbCabType) {
      //   let lower = dbCabType.toLowerCase();
      //   if (lower.includes('mini')) dbCabType = 'mini cab';
      //   else if (lower.includes('sedan')) dbCabType = 'sedan';
      //   else if (lower.includes('suv')) dbCabType = 'suv';
      //   else if (lower.includes('12')) dbCabType = '12 seater';
      //   else if (lower.includes('lux')) dbCabType = 'luxury';
      //   else dbCabType = 'mini cab'; // Fallback
      // }
      let dbCabType = cabType ? cabType.trim() : 'mini eco';

      // Generate a secure 4-digit Ride OTP for this booking
      const rideOtp = Math.floor(1000 + Math.random() * 9000);

      // Create the booking request
      await CabBookingRequest.create({
        bookingId,
        userId,
        vehicleId,
        date: startDate || null,
        time: startTime || null,
        startLocationLatitude: startLocation.latitude,
        startLocationLongitude: startLocation.longitude,
        startLocationAddress: startLocation.address || "",
        endLocationLatitude: endLocation?.latitude || startLocation.latitude,
        endLocationLongitude: endLocation?.longitude || startLocation.longitude,
        endLocationAddress: endLocation?.address || startLocation.address || "",
        estimatedPrice: estimatedPrice,
        status: "pending",
        paymentStatus: "pending",
        cabType: dbCabType,
        confirmationFee: confirmationFeeAmount,
        payToDriver: payToDriverAmount,
        rideOtp: rideOtp,
        bookingType: bookingType || "Local"
      }, { transaction: t });

      await t.commit();
    } catch (innerError) {
      await t.rollback();
      throw innerError;
    }

    // Notify drivers ONLY if this is a live Local ride or a specific vehicle was already picked.
    if (bookingType === 'Local' || bookingType === 'Daily' || vehicleId) {
      const notificationText = "New booking request nearby";
      const notificationMetadata = { bookingId, startLocation, endLocation, estimatedPrice };

      // DISABLED - Express Route cannot be called directly without res object
      // const drivers = await searchForCabs({ body: { fromLocation: startLocation, searchRadius: 5 } });

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
    }

    const customer = await User.findByPk(userId);
    if (customer && customer.fcmToken) {
      await sendPushNotification(customer.fcmToken, "Complete Your Payment", `Please complete the 26% confirmation fee (Rs. ${confirmationFeeAmount}) to confirm your cab booking.`);
    }

    res.status(201).json({ message: "Booking created and drivers notified", bookingId, estimatedPrice });
  } catch (error) {
    require('fs').appendFileSync('C:/Users/Admin/Spintrip New Vision/cab_error.txt', new Date().toISOString() + '\\n' + (error.stack || error.message) + '\\n\\n');
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
    let host = await Host.findByPk(req.user.id);
    if (!host) {
      if (req.user.role === 'admin' || req.user.role === 'Driver' || req.user.role === 'driver' || req.user.role === 'host') {
        host = await Host.create({ id: req.user.id }); // Auto-create host profile to satisfy Vehicle foreign key
      } else {
        return res.status(401).json({ message: "Unauthorized: You must be a Host, Driver, or Admin to register a Cab." });
      }
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

    // Check if the user generating the Cab is actually a Driver
    const userRoleCheck = await User.findByPk(req.user.id);
    const isDriver = userRoleCheck && (userRoleCheck.role === 'Driver' || userRoleCheck.role === 'driver');

    // Create Cab entry
    await Cab.create({
      vehicleid: vehicleId,
      model: vehicleModel,
      type,
      brand,
      variant,
      color,
      bodytype: bodyType,
      city,
      driverId: isDriver ? req.user.id : null,
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
    res.status(200).json({ message: 'OTP sent successfully to the provided phone number.', otp: otp });
  } catch (error) {
    console.error('Error during driver login:', error);
    res.status(500).json({ message: 'Error during login', error });
  }
};
/**
 * Estimate price using Google Maps API for distance and traffic conditions
 */
/**
 * Bulk Estimation: Calculates distance/duration ONCE and estimates 
 * prices for AN ARRAY of cab types. Crucial for scaling.
 */
// const getBulkEstimates = async (req, res) => {
//     const { origin, destination, cabTypes, bookingType = "Local", address = "" } = req.body;

//     try {
//         if (!origin || !destination || !cabTypes || !Array.isArray(cabTypes)) {
//             return res.status(400).json({ message: "Missing required parameters" });
//         }

//         // 1. Calculate Distance Matrix ONCE for all types
//         let distanceKm = 0, durationMin = 0;
//         try {
//             const originStr = typeof origin === "string" ? origin : `${origin.latitude},${origin.longitude}`;
//             const destStr = typeof destination === "string" ? destination : `${destination.latitude},${destination.longitude}`;
//             const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${GOOGLE_MAPS_API_KEY}`;
//             const googleRes = await axios.get(url);
//             const element = googleRes.data?.rows?.[0]?.elements?.[0];
//             if (element?.status === "OK") {
//                 distanceKm = element.distance.value / 1000;
//                 durationMin = element.duration.value / 60;
//             }
//         } catch (e) { distanceKm = 30; durationMin = 60; } // Failsafe

//         // 2. Normalize address
//         let addr = (address || "").toLowerCase().trim().replace(/bengaluru/g, "bangalore");

//         // 3. Loop through types in memory
//         const results = {};
//         for (const type of cabTypes) {
//             const rateCards = await HostCabRateCard.findAll({
//                 where: { cabType: { [Op.iLike]: type.trim() } },
//                 order: [['createdAt', 'DESC']]
//             });

//             const card = rateCards.find(rc => addr.includes(rc.city?.toLowerCase())) || rateCards[0];

//             if (card) {
//                 let base = distanceKm * (card.outstationPerKmPrice || 15);
//                 if (bookingType === 'Airport') base = card.airportTransferPrice || 1200;

//                 results[type] = {
//                     estimatedPrice: Math.round(base * 1.05), // + 5% GST
//                     distance: distanceKm,
//                     duration: durationMin
//                 };
//             }
//         }
//         res.status(200).json({ estimates: results });
//     } catch (error) { res.status(500).json({ message: "Server error" }); }
// };

// --- Add getBulkEstimates to your module.exports at the bottom ---


// const getEstimate = async (req, res) => {
//   try {
//     // Extract data from the request body
//     const { origin, destination, vehicleId, trafficConditions, cabType, bookingType, address } = req.body;

//     // Validate the input (vehicleId is optional now for generic quotes)
//     if (!origin) {
//       return res.status(400).json({ message: "Missing required parameters: origin." });
//     }

//     // Call the estimatePrice function with the required parameters
//     const result = await estimatePrice({ origin, destination: destination || origin, vehicleId, trafficConditions, cabType, bookingType, address });

//     // Return the result to the client
//     res.status(200).json(result);
//   } catch (error) {
//     console.error("Error in /get-estimate route:", error.message);
//     res.status(500).json({ message: "Failed to estimate price.", error: error.message });
//   }
// };

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

    // Estimate price internally (Now includes exact commission breakdown)
    const {
      subtotalBasePrice,
      gstAmount,
      estimatedPrice,
      commissionAmount,
      tdsAmount,
      driverEarnings,
    } = await estimatePrice({ origin: startLocation, destination: endLocation, cabType, bookingType });

    if (!estimatedPrice || !commissionAmount) {
      return res.status(500).json({ message: "Failed to estimate price or calculate commission." });
    }

    const t = await sequelize.transaction();
    try {
      // Wallet check for exact estimatedPrice calculation
      const wallet = await Wallet.findOne({ where: { userId }, transaction: t });

      if (!wallet || wallet.balance < estimatedPrice) {
        await t.rollback();
        return res.status(402).json({
          message: `Insufficient Spintrip wallet balance. The total prepaid fare is Rs. ${estimatedPrice}. Please recharge your wallet.`
        });
      }

      // Verify user has balance before searching for cab
      // Wallet WILL BE DEBITED explicitly ONLY when the Trip strictly Starts natively.
      const bookingId = uuid.v4();

      // Create a soft booking entry in the database
      await CabBookingRequest.create({
        bookingId,
        userId,
        endTripTime: null,
        vehicleId,
        startLocationLatitude: startLocation.latitude,
        startLocationLongitude: startLocation.longitude,
        endLocationLatitude: endLocation.latitude,
        endLocationLongitude: endLocation?.longitude || startLocation.longitude,
        estimatedPrice: estimatedPrice,
        status: 5, // Status 5 is 'Assigning Driver'
      }, { transaction: t });

      await t.commit();
    } catch (innerError) {
      await t.rollback();
      throw innerError;
    }

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
    const booking = await CabBookingRequest.findOne({ where: { bookingId, status: 5 } });
    if (!booking) {
      return res.status(404).json({ message: "Soft booking not found or already taken." });
    }

    // Update soft booking to confirmed (status 1)
    await CabBookingRequest.update(
      { status: 1, driverId },
      { where: { bookingId } }
    );

    // Set Driver to Offline so they don't appear in new ping searches
    await Driver.update({ isActive: true }, { where: { id: driverId } });

    // Generate an OTP for the trip
    const tripOtp = generateOTP();

    // Save the confirmed booking in `Booking` table
    const newBooking = await Booking.create({
      Bookingid: bookingId,
      Date: new Date(),
      vehicleid: booking.vehicleId,
      id: booking.userId,
      status: 1, // 1 indicates "confirmed"
      amount: booking.subtotalBasePrice || booking.estimatedPrice, // Save exact base fare
      GSTAmount: booking.gstAmount || 0,
      TDSAmount: booking.tdsAmount || 0,
      totalUserAmount: booking.estimatedPrice, // Total charged to customer
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
      tripOtp: booking.CabBookingAccepted?.tripOtp,
      booking: {
        bookingId: booking.bookingId,
        estimatedPrice: booking.estimatedPrice,
        confirmationFee: booking.confirmationFee,
        payToDriver: booking.payToDriver,
        gstAmount: booking.gstAmount,
        tdsAmount: booking.tdsAmount,
        driverEarnings: booking.driverEarnings,
        cabType: booking.cabType,
        bookingType: booking.bookingType,
        startLocationAddress: booking.startLocationAddress,
        endLocationAddress: booking.endLocationAddress,
        date: booking.date,
        time: booking.time
      }
    });
  } catch (error) {
    console.error("Error checking booking status:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Superhost Assign Driver to Booking
 */

// const getMatchedOperationalCity = async (address, inputCity = "") => {
//   try {
//      const cities = await City.findAll({ where: { isActive: true } });
//      let addrLower = (address || "").toLowerCase().trim();
//      let cityLower = (inputCity || "").toLowerCase().trim();

//      // 1. If App sent a clean city name, use it first
//      if (cityLower) {
//         const match = cities.find(c => c.name.toLowerCase() === cityLower || cityLower.includes(c.name.toLowerCase()));
//         if (match) return match.name;
//      }

//      // 2. Normalization & Airport Aliases
//      addrLower = addrLower.replace(/bengaluru/g, "bangalore");
//      if (addrLower.includes("560300") || addrLower.includes("devanahalli")) {
//         addrLower += " bangalore"; // Map Bangalore Airport ZIP to Bangalore
//      }

//      // 3. Match against the operational City table
//      for (const cityObj of cities) {
//         let cityName = cityObj.name.toLowerCase().trim();
//         cityName = cityName.replace(/bengaluru/g, "bangalore");

//         if (addrLower.includes(cityName)) {
//            return cityObj.name; // Return the exact name from your DB
//         }
//      }
//      return null;
//   } catch (err) {
//      console.error("City Matcher Error:", err.message);
//      return null;
//   }
// };

const superhostAssignDriver = async (req, res) => {
  const { bookingId, driverId, vehicleId } = req.body;
  const superhostId = req.user.id;

  try {
    const booking = await CabBookingRequest.findOne({ where: { bookingId, status: 5 } });
    if (!booking) {
      return res.status(400).json({ message: "Booking not found or not in searching state." });
    }

    // Verify ownership via hostId or parentHostId
    const vehicle = await Vehicle.findOne({
      include: [{ model: Host, where: { [Op.or]: [{ id: superhostId }, { parentHostId: superhostId }] } }],
      where: { vehicleid: vehicleId }
    });

    if (!vehicle) return res.status(403).json({ message: "Unauthorized: Vehicle does not belong to your fleet." });

    // Link vehicle to booking and assign driver
    booking.vehicleId = vehicleId;
    booking.driverid = driverId;
    booking.status = 1; // 1 = Upcoming / Confirmed
    await booking.save();

    // Notify Driver
    const device = await Driver.findOne({ where: { id: driverId } });
    if (device && device.fcmToken) {
      await sendPushNotification(device.fcmToken, "New Ride Assigned", "You have been assigned a new ride by your Fleet Admin.");
    }

    // Notify User
    const userDevice = await User.findOne({ where: { id: booking.userId } });
    if (userDevice && userDevice.fcmToken) {
      await sendPushNotification(userDevice.fcmToken, "Driver Assigned", "Your cab is on the way!");
    }

    res.status(200).json({ message: "Driver and vehicle assigned successfully.", booking });
  } catch (error) {
    console.error("Error assigning driver:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Bank Transfer Upload/Confirmation
 */
const confirmBankPayment = async (req, res) => {
  const { bookingId, transactionRef } = req.body;

  try {
    const booking = await CabBookingRequest.findOne({ where: { bookingId } });
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    // Mock verification
    booking.paymentStatus = "paid";
    booking.amountPaid = booking.estimatedPrice || booking.finalPrice || 0;
    await booking.save();

    res.status(200).json({ message: "Payment confirmed via bank transfer. Waiting for assignment.", booking });
  } catch (error) {
    console.error("Error confirming payment:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Track Driver Live Location
 */
const trackDriverLocation = async (req, res) => {
  const { bookingId } = req.params;

  try {
    const booking = await CabBookingRequest.findOne({ where: { bookingId } });
    if (!booking || !booking.vehicleId) {
      return res.status(404).json({ message: "Booking or assigned vehicle not found." });
    }

    const vehicleLocation = await VehicleAdditional.findOne({
      where: { vehicleid: booking.vehicleId },
      attributes: ['latitude', 'longitude', 'timestamp']
    });

    if (!vehicleLocation) {
      return res.status(404).json({ message: "Location data unavailable." });
    }

    res.status(200).json({
      latitude: vehicleLocation.latitude,
      longitude: vehicleLocation.longitude,
      lastUpdated: vehicleLocation.timestamp
    });
  } catch (error) {
    console.error("Error tracking driver:", error);
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
const startTrip = async (req, res) => {
  const { bookingId, otp } = req.body;
  const driverId = req.user.id;

  if (!otp) {
    return res.status(400).json({ message: "OTP is required to start the trip." });
  }

  const transaction = await sequelize.transaction();
  try {
    const booking = await Booking.findOne({
      where: { Bookingid: bookingId, status: 1 }, // 1 = confirmed
      transaction,
    });

    if (!booking) {
      await transaction.rollback();
      return res.status(404).json({ message: "Booking not found or not in confirmed state." });
    }

    const acceptedBooking = await CabBookingAccepted.findOne({
      where: { bookingId },
      transaction
    });

    if (!acceptedBooking || String(acceptedBooking.tripOtp) !== String(otp)) {
      await transaction.rollback();
      return res.status(400).json({ message: "Invalid OTP to start trip." });
    }

    const assignedDriver = await Cab.findOne({
      where: { driverId: driverId, vehicleid: booking.vehicleId },
      transaction,
    });

    if (!assignedDriver) {
      await transaction.rollback();
      return res.status(403).json({ message: "Driver not authorized for this booking." });
    }

    // The Passenger Prepaid Fare was cleanly deducted structurally ahead of time inside 'createSoftBooking'.
    // Double-Billing logic organically prevented natively.

    // Process Wallet Deduction (100% Prepaid Fare)
    const userId = booking.id;
    const estimatedPrice = booking.amount || 0; // The total booking amount

    const wallet = await Wallet.findOne({ where: { userId }, transaction });
    if (!wallet || wallet.balance < estimatedPrice) {
      await transaction.rollback();
      return res.status(402).json({ message: `User has insufficient wallet balance to start trip. Required: Rs. ${estimatedPrice}.` });
    }

    // Deduct full prepaid fare natively upon trip commencement natively
    wallet.balance = parseFloat(wallet.balance) - parseFloat(estimatedPrice);
    await wallet.save({ transaction });

    await WalletTransaction.create({
      id: uuid.v4(),
      walletId: wallet.id,
      amount: parseFloat(estimatedPrice),
      type: 'DEBIT',
      description: 'Cab Booking Prepaid Fare',
      referenceId: bookingId,
    }, { transaction });

    // Update statuses
    await Booking.update(
      { status: 2, startTripDate: new Date() }, // 2 = started
      { where: { Bookingid: bookingId }, transaction }
    );

    await CabBookingRequest.update(
      { status: "started", startTripTime: new Date() },
      { where: { bookingId }, transaction }
    );

    await transaction.commit();

    // Notify User
    const userDevice = await Device.findOne({ where: { userId: booking.id } });
    if (userDevice && userDevice.token) {
      sendPushNotification(userDevice.token, "Trip Started", "Your ride has officially started. Have a safe journey!");
    }

    res.status(200).json({ message: "Trip started successfully.", bookingId });
  } catch (error) {
    await transaction.rollback();
    console.error("Error starting trip:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const endTrip = async (req, res) => {
  const { bookingId, otp } = req.body;
  const driverId = req.user.id;

  if (!otp) {
    return res.status(400).json({ message: "OTP is required to end the trip." });
  }

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

    // OTP Verification against CabBookingAccepted
    const acceptedBooking = await CabBookingAccepted.findOne({
      where: { cabBookingId: bookingId },
      transaction
    });

    if (!acceptedBooking || acceptedBooking.tripOtp !== otp) {
      await transaction.rollback();
      return res.status(400).json({ message: "Invalid OTP for ending trip." });
    }

    // Validate that the driver is authorized for this booking
    const assignedDriver = await Cab.findOne({
      where: { driverId: driverId, vehicleid: booking.vehicleid },
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
        status: 3, // 3 = completed (matches Self-drive invoice trigger)
        endTripDate: new Date(),
        endTripTime: new Date(),
      },
      { where: { Bookingid: bookingId }, transaction }
    );

    // Set Driver to Online so they can receive new pings
    await Driver.update({ isActive: true }, { where: { id: driverId }, transaction });

    // Remove the soft booking entry
    await CabBookingRequest.destroy({ where: { bookingId }, transaction });

    // --- REFERRAL SYSTEM LOGIC ---
    // Check if this is the user's first successful booking to trigger rewards
    const bookingUser = await User.findByPk(booking.id, { transaction });
    if (bookingUser && bookingUser.referredBy) {
        const completedRidesCount = await Booking.count({
            where: { id: booking.id, status: 3 },
            transaction
        });

        if (completedRidesCount === 1) {
            const referrer = await User.findByPk(bookingUser.referredBy, { transaction });
            if (referrer && referrer.referralCount < 50) {
                // 1. Credit Referrer
                await ReferralReward.create({
                    userId: referrer.id,
                    amount: 100.0,
                    status: 'earned',
                    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }, { transaction });

                // 2. Increment Referrer's count
                await referrer.increment('referralCount', { by: 1, transaction });

                // 3. Credit Referee
                await ReferralReward.create({
                    userId: bookingUser.id,
                    amount: 100.0,
                    status: 'earned',
                    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }, { transaction });
            }
        }
    }
    // ----------------------------

    await transaction.commit(); // Commit the transaction

    // Notify User
    const userDevice = await Device.findOne({ where: { userId: booking.id } });
    if (userDevice && userDevice.token) {
      sendPushNotification(userDevice.token, "Trip Ended", "Your ride has been completed successfully.");
    }

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

// const getCabAvailability = async (req, res) => {
//   const { address, city } = req.body; // App now sends 'city' too

//   try {
//      const matchedCity = await getMatchedOperationalCity(address, city);

//      if (!matchedCity) {
//         return res.status(200).json({ 
//            available: false, 
//            services: [], 
//            message: "We're not operational in this area yet." 
//         });
//      }

//      // Find rate cards FOR THIS CITY ONLY
//      const rateCards = await HostCabRateCard.findAll({
//         where: { city: { [Op.iLike]: matchedCity } }
//      });

//      if (rateCards.length === 0) {
//         return res.status(200).json({ available: false, services: [], message: `No services in ${matchedCity}` });
//      }

//      let services = new Set(['Local']);
//      let cabTypes = new Set();
//      for (const card of rateCards) {
//         if (card.airportTransferPrice) services.add('Airport');
//         if (card.outstationPerKmPrice) services.add('Outstation');
//         if (card.cabType) cabTypes.add(card.cabType);
//      }

//      return res.status(200).json({
//         available: true,
//         services: Array.from(services),
//         cabTypes: Array.from(cabTypes),
//         city: matchedCity
//      });
//   } catch (error) {
//      res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

const getMatchedOperationalCity = async (address, inputCity = "") => {
  try {
    const cities = await City.findAll({ where: { isActive: true } });
    let addrLower = (address || "").toLowerCase().trim();
    let cityLower = (inputCity || "").toLowerCase().trim();

    if (cityLower) {
      const match = cities.find(c => c.name.toLowerCase() === cityLower || cityLower.includes(c.name.toLowerCase()));
      if (match) return match.name;
    }
    addrLower = addrLower.replace(/bengaluru/g, "bangalore");
    if (addrLower.includes("560300") || addrLower.includes("devanahalli")) {
      addrLower += " bangalore";
    }
    for (const cityObj of cities) {
      let cityName = cityObj.name.toLowerCase().trim().replace(/bengaluru/g, "bangalore");
      if (addrLower.includes(cityName)) return cityObj.name;
    }
    return null;
  } catch (err) {
    return null;
  }
};
/**
 * Price Estimator Logic
 */
/**
 * Price Estimator Logic: Single Trip version (Matches Bulk Home Screen Pricing)
 */
// const estimatePrice = async ({ origin, destination, cabType = "mini cab", bookingType = "Local", address = "", city = "" }) => {
//   try {
//     if (!origin) throw new Error("Missing parameters");

//     // 1. Calculate Distance & Duration (Failsafe to 30km if API fails)
//     let distanceKm = 30, durationMin = 60;
//     try {
//       const originStr = typeof origin === "string" ? origin : `${origin.latitude},${origin.longitude}`;
//       const destStr = typeof destination === "string" ? destination : `${destination.latitude},${destination.longitude}`;
//       const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${GOOGLE_MAPS_API_KEY}`;
//       const response = await axios.get(url);
//       const element = response.data?.rows?.[0]?.elements?.[0];
//       if (element?.status === "OK") {
//         distanceKm = element.distance.value / 1000;
//         durationMin = element.duration.value / 60;
//       }
//     } catch (googleError) {
//       console.error("estimatePrice Dist Error:", googleError.message);
//     }

//     // 2. Load Rate Cards for this Cab Category
//     const rateCards = await HostCabRateCard.findAll({
//       where: { cabType: { [Op.iLike]: (cabType.trim() || "Mini") } },
//       order: [['createdAt', 'DESC']]
//     });

//     // 3. Match City & Detect Airport Address
//     const matchedCity = await getMatchedOperationalCity(address, city);
//     const destAddress = (typeof destination === 'string' ? destination : (destination?.address || "")).toLowerCase();

//     // 🚀 Smart Detection: Force airport rates if "airport" is in the destination address
//     const isActuallyAirport =
//       bookingType !== 'Outstation' &&
//       (bookingType === 'Airport' || destAddress.includes("airport")) &&
//       distanceKm < 50;

//     let rateCard = null;
//     if (matchedCity) {
//       rateCard = rateCards.find(rc => rc.city && rc.city.toLowerCase() === matchedCity.toLowerCase());
//     }
//     if (!rateCard && rateCards.length > 0) rateCard = rateCards[0];

//     if (!rateCard) return { estimatedPrice: null, message: `No services in this area.` };

//     // 4. Base Price Calculation
//     let subtotalBasePrice = 0;
//     if (isActuallyAirport) {
//       subtotalBasePrice = rateCard.airportTransferPrice || 1200;
//       distanceKm = 30; durationMin = 60; // Standard display fallbacks
//     } else if (bookingType === 'Rentals') {
//       subtotalBasePrice = rateCard.fullDayPrice || 2500;
//     } else if (bookingType === 'Outstation') {
//       subtotalBasePrice = (300 * (rateCard.outstationPerKmPrice || 20)) + (rateCard.driverAllowancePerDay || 300);
//     } else {
//       subtotalBasePrice = distanceKm * (rateCard.outstationPerKmPrice || 15);
//     }

//     // 5. Multipliers (Traffic & Surge)
//     const ratio = distanceKm > 0 ? durationMin / distanceKm : 0;
//     const trafficMult = ratio > 2.5 ? 1.3 : (ratio > 1.5 ? 1.1 : 1);
//     const hostSurge = rateCard.surgeMultiplier || 1.0;
//     const toll = rateCard.tollCharges || 0;

//     // 🛡️ THE SAFETY FLOOR: 500 for Airport/Rentals, 100 for Local
//     const total = Math.max(
//       Math.round((subtotalBasePrice * trafficMult * hostSurge) + toll),
//       isActuallyAirport ? 500 : 100
//     );

//     // 6. Fee Breakdowns (GST, Commission, TDS)
//     const netBase = total / 1.05;
//     const commission = netBase * 0.20;
//     const driverEarningsBeforeTDS = netBase - commission;
//     const tdsAmount = driverEarningsBeforeTDS * 0.01;
//     const finalDriverEarnings = driverEarningsBeforeTDS - tdsAmount;

//     return {
//       distance: distanceKm,
//       duration: durationMin,
//       subtotalBasePrice: Math.round(netBase),
//       gstAmount: Math.round(total - netBase),
//       estimatedPrice: total,
//       commissionAmount: Math.round(commission),
//       tdsAmount: Math.round(tdsAmount),
//       confirmationFee: Math.round(total - finalDriverEarnings),
//       driverEarnings: Math.round(finalDriverEarnings)
//     };
//   } catch (err) {
//     console.error("Critical estimatePrice Error:", err.message);
//     return { estimatedPrice: 105, message: "Fallback price" };
//   }
// };

/**
 * High-Performance Bulk Estimation (For Scaling)
 */
/**
 * Bulk Estimation: Fixed version with Auto-Airport Detection and Minimum Fare Guards.
 */
// const getBulkEstimates = async (req, res) => {
//   const { origin, destination, cabTypes, bookingType = "Local", address = "", city = "" } = req.body;
//   try {
//     if (!origin || !destination || !cabTypes || !Array.isArray(cabTypes)) {
//       return res.status(400).json({ message: "Missing required parameters" });
//     }

//     // 1. Calculate Distance (Failsafe to 30km if API fails)
//     let distanceKm = 30, durationMin = 60;
//     try {
//       const originStr = typeof origin === "string" ? origin : `${origin.latitude},${origin.longitude}`;
//       const destStr = typeof destination === "string" ? destination : `${destination.latitude},${destination.longitude}`;
//       const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${GOOGLE_MAPS_API_KEY}`;
//       const googleRes = await axios.get(url);
//       const element = googleRes.data?.rows?.[0]?.elements?.[0];
//       if (element?.status === "OK") {
//         distanceKm = element.distance.value / 1000;
//         durationMin = element.duration.value / 60;
//       }
//     } catch (e) { }

//     // 2. Identify City & Smart Airport Detection
//     const matchedCity = await getMatchedOperationalCity(address, city);
//     const destAddress = (destination?.address || "").toLowerCase();

//     // 🚀 Detect "Airport" trips even if user is in "Local" tab
//     const isActuallyAirport =
//       bookingType !== 'Outstation' &&
//       (bookingType === 'Airport' || destAddress.includes("airport")) &&
//       distanceKm < 50;

//     const results = {};
//     for (const type of cabTypes) {
//       const rateCards = await HostCabRateCard.findAll({
//         where: { cabType: { [Op.iLike]: type.trim() } },
//         order: [['createdAt', 'DESC']]
//       });

//       const card = (matchedCity ? rateCards.find(rc => rc.city?.toLowerCase() === matchedCity.toLowerCase()) : null) || rateCards[0];

//       if (card) {
//         let base = distanceKm * (card.outstationPerKmPrice || 15);
//         if (isActuallyAirport) base = card.airportTransferPrice || 1200;
//         if (bookingType === 'Rentals') base = card.fullDayPrice || 2500;

//         const ratio = distanceKm > 0 ? durationMin / distanceKm : 0;
//         const trafficMult = ratio > 2.5 ? 1.3 : (ratio > 1.5 ? 1.1 : 1);
//         const hostSurge = card.surgeMultiplier || 1.0;

//         let total = Math.round((base * trafficMult * hostSurge) + (card.tollCharges || 0));

//         // 🛡️ THE PRODUCTION FLOOR (Ensures ₹105 is the absolute minimum)
//         if (isActuallyAirport || bookingType === 'Rentals') {
//           total = Math.max(total, 500);
//         } else {
//           total = Math.max(total, 100);
//         }

//         results[type] = {
//           estimatedPrice: Math.round(total * 1.05), // GST
//           distance: distanceKm,
//           duration: durationMin,
//           commissionAmount: Math.round((total / 1.05) * 0.20)
//         };
//       }
//     }
//     res.status(200).json({ estimates: results });
//   } catch (error) {
//     res.status(500).json({ message: "Server error" });
//   }
// };

/**
 * Service Availability Discovery
 */
const getCabAvailability = async (req, res) => {
  const { address, city } = req.body;
  try {
    const matchedCity = await getMatchedOperationalCity(address, city);
    if (!matchedCity) return res.status(200).json({ available: false, services: [], message: "Not operational here." });
    const rateCards = await HostCabRateCard.findAll({ where: { city: { [Op.iLike]: matchedCity }, isActive: true } });
    if (rateCards.length === 0) return res.status(200).json({ available: false, services: [], message: "No active rate cards." });

    let services = new Set(['Local']);
    let cabTypes = new Set();
    for (const card of rateCards) {
      if (card.airportTransferPrice) services.add('Airport');
      if (card.outstationPerKmPrice) services.add('Outstation');
      if (card.cabType) cabTypes.add(card.cabType);
    }

    return res.status(200).json({
      available: true,
      services: Array.from(services),
      cabTypes: Array.from(cabTypes),
      city: matchedCity
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
// ... Include standard methods like bookCab, addDriver, toggleDriverStatus, etc. ...
// (I have kept these aligned with your existing database logic)
const getEstimate = async (req, res) => {
  const { origin, destination, vehicleId, cabType, bookingType, address, city } = req.body;
  const result = await estimatePrice({ origin, destination: destination || origin, vehicleId, cabType, bookingType, address, city });
  res.status(200).json(result);
};

/**
 * Core Dynamic Price Estimation Engine
 */
const estimatePrice = async ({ origin, destination, cabType, bookingType = "Local", address = "", city = "" }) => {
  try {
    const originStr = typeof origin === "string" ? origin : `${origin.latitude},${origin.longitude}`;
    const destStr = typeof destination === "string" ? destination : `${destination.latitude},${destination.longitude}`;

    const googleRes = await axios.get(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${GOOGLE_MAPS_API_KEY}`
    );

    const element = googleRes.data?.rows?.[0]?.elements?.[0];
    let distanceKm = 10, durationMin = 20;
    if (element?.status === "OK") {
      distanceKm = element.distance.value / 1000;
      durationMin = element.duration.value / 60;
    }

    const matchedCity = await getMatchedOperationalCity(address, city);

    // 🔥 UNIVERSAL SMART ROUTING (THE FIX)
    const originAddr = (origin?.address || "").toLowerCase();
    const destAddr = (destination?.address || "").toLowerCase();
    let evaluatedType = bookingType;

    if ((originAddr.includes("airport") || destAddr.includes("airport")) && distanceKm < 50) {
      evaluatedType = 'Airport'; // Keyword match = Airport
    } else if (distanceKm >= 50) {
      evaluatedType = 'Outstation'; // 50km+ = Outstation
    } else if (bookingType !== 'Rentals' && bookingType !== 'Outstation') {
      evaluatedType = 'Local'; // Short Non-Airport = Local
    }

    const rateCards = await HostCabRateCard.findAll({
      where: {
        cabType: { [Op.iLike]: cabType.trim() },
        isActive: true
      },
      order: [['createdAt', 'DESC']]
    });

    const rateCard = (matchedCity ? rateCards.find(rc => rc.city?.toLowerCase() === matchedCity.toLowerCase()) : null) || rateCards[0];

    if (!rateCard) return { estimatedPrice: null, error: "No rate card" };

    let subtotalBasePrice = 0;

    if (evaluatedType === 'Airport') {
      const airportBase = rateCard.airportTransferPrice || 0;
      const airportExtra = rateCard.airportExtraKmRate || 0;
      subtotalBasePrice = (distanceKm <= 35) ? airportBase : (airportBase + (distanceKm - 35) * airportExtra);
    } else if (evaluatedType === 'Rentals') {
      subtotalBasePrice = rateCard.fullDayPrice || 0;
    } else if (evaluatedType === 'Outstation') {
      const perKm = rateCard.outstationPerKmPrice || 0;
      const allowance = rateCard.driverAllowancePerDay || 0;
      subtotalBasePrice = (Math.max(distanceKm, 50) * perKm) + allowance;
    } else {
      // ✅ LOCAL BASE FARE Logic
      const baseFare = 150;
      const localExtra = rateCard.localExtraKmRate || 0;
      subtotalBasePrice = (distanceKm <= 2) ? baseFare : (baseFare + (distanceKm - 2) * localExtra);
    }

    const ratio = distanceKm > 0 ? durationMin / distanceKm : 0;
    const trafficMult = ratio > 2.5 ? 1.3 : (ratio > 1.5 ? 1.1 : 1);
    const hostSurge = rateCard.surgeMultiplier || 1.0;

    const total = (evaluatedType === 'Airport' || evaluatedType === 'Rentals')
      ? Math.max(Math.round((subtotalBasePrice * trafficMult * hostSurge) + (rateCard.tollCharges || 0)), 500)
      : Math.round((subtotalBasePrice * trafficMult * hostSurge) + (rateCard.tollCharges || 0));

    const netBase = total / 1.05;
    return {
      distance: distanceKm,
      duration: durationMin,
      subtotalBasePrice: Math.round(netBase),
      gstAmount: Math.round(total - netBase),
      estimatedPrice: total > 0 ? total : null,
      commissionAmount: Math.round(netBase * 0.20),
      tdsAmount: Math.round(netBase * 0.01), // Section 194-O (1% of Gross)
      driverEarnings: Math.round(netBase - (netBase * 0.20) - (netBase * 0.01)),
      payToDriver: Math.round(netBase - (netBase * 0.20) - (netBase * 0.01)),
      confirmationFee: Math.round(total - (netBase - (netBase * 0.20) - (netBase * 0.01))),
      extraHourRate: rateCard.extraHourRate || 0,
      extraKmRate: rateCard.extraKmRate || 0,
      localExtraKmRate: rateCard.localExtraKmRate || 0,
      airportExtraKmRate: rateCard.airportExtraKmRate || 0
    };
  } catch (err) {
    return { estimatedPrice: null, error: "Calculation failed" };
  }
};


/**
 * High-Performance Bulk Estimation (Optimized for Dynamic Formats)
 */
const getBulkEstimates = async (req, res) => {
  const { origin, destination, cabTypes, bookingType = "Local", address = "", city = "" } = req.body;
  try {
    const originStr = typeof origin === "string" ? origin : `${origin.latitude},${origin.longitude}`;
    const destStr = typeof destination === "string" ? destination : `${destination.latitude},${destination.longitude}`;
    const googleRes = await axios.get(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${GOOGLE_MAPS_API_KEY}`
    );

    const element = googleRes.data?.rows?.[0]?.elements?.[0];
    let distanceKm = (element?.status === "OK") ? (element.distance.value / 1000) : 10;
    let durationMin = (element?.status === "OK") ? (element.duration.value / 60) : 20;

    const matchedCity = await getMatchedOperationalCity(address, city);

    // 🔥 UNIVERSAL SMART ROUTING
    const originAddr = (origin?.address || "").toLowerCase();
    const destAddr = (destination?.address || "").toLowerCase();
    let evaluatedType = bookingType;

    if ((originAddr.includes("airport") || destAddr.includes("airport")) && distanceKm < 50) {
      evaluatedType = 'Airport';
    } else if (distanceKm >= 50) {
      evaluatedType = 'Outstation';
    } else if (bookingType !== 'Rentals' && bookingType !== 'Outstation') {
      evaluatedType = 'Local';
    }

    const results = {};
    for (const type of cabTypes) {
      const rateCards = await HostCabRateCard.findAll({
        where: {
          cabType: { [Op.iLike]: type.trim() },
          isActive: true
        },
        order: [['createdAt', 'DESC']]
      });
      const card = (matchedCity ? rateCards.find(rc => rc.city?.toLowerCase() === matchedCity.toLowerCase()) : null) || rateCards[0];

      if (card) {
        let base = 0;
        if (evaluatedType === 'Airport') {
          const airportBase = card.airportTransferPrice || 0;
          const airportExtra = card.airportExtraKmRate || 0;
          base = (distanceKm <= 35) ? airportBase : (airportBase + (distanceKm - 35) * airportExtra);
        } else if (evaluatedType === 'Rentals') {
          base = card.fullDayPrice || 0;
        } else if (evaluatedType === 'Outstation') {
          const perKm = card.outstationPerKmPrice || 0;
          const allowance = card.driverAllowancePerDay || 0;
          base = (Math.max(distanceKm, 50) * perKm) + allowance;
        } else {
          // ✅ LOCAL BASE FARE Logic
          const baseFare = 150;
          const localExtra = card.localExtraKmRate || 0;
          base = (distanceKm <= 2) ? baseFare : (baseFare + (distanceKm - 2) * localExtra);
        }

        const ratio = distanceKm > 0 ? durationMin / distanceKm : 0;
        const total = Math.round((base * (ratio > 2.5 ? 1.3 : 1) * (card.surgeMultiplier || 1.0)) + (card.tollCharges || 0));

        if (total > 0) {
          const netBase = total / 1.05;
          const comm = netBase * 0.20;
          const tds = netBase * 0.01;
          const driverPay = Math.round((netBase - comm - tds) * 100) / 100;

          results[type] = {
            estimatedPrice: total,
            distance: distanceKm,
            duration: durationMin,
            extraHourRate: card.extraHourRate || 0,
            extraKmRate: card.extraKmRate || 0,
            localExtraKmRate: card.localExtraKmRate || 0,
            airportExtraKmRate: card.airportExtraKmRate || 0,
            tdsAmount: Math.round(tds * 100) / 100,
            payToDriver: driverPay,
            confirmationFee: Math.round((total - driverPay) * 100) / 100
          };
        }
      }
    }
    res.status(200).json({ estimates: results });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};




/**
 * Shared Helper: Refund Gold Coins if a booking is cancelled
 */
const refundBookingCoins = async (bookingId, transaction) => {
  try {
    // 1. Find the DEBIT transaction for this booking
    const debitTx = await WalletTransaction.findOne({
      where: {
        referenceId: bookingId,
        type: 'DEBIT',
        description: { [Op.like]: '%Gold Coins Used%' }
      },
      transaction
    });

    if (!debitTx) return; // No coins used, nothing to refund

    // 2. Check if already refunded to prevent double-credits
    const alreadyRefunded = await WalletTransaction.findOne({
      where: {
        referenceId: bookingId,
        type: 'CREDIT',
        description: { [Op.like]: '%Refund%' }
      },
      transaction
    });

    if (alreadyRefunded) return;

    // 3. Find the wallet
    const wallet = await Wallet.findByPk(debitTx.walletId, { transaction });
    if (!wallet) return;

    // 4. Perform Refund
    const refundAmount = debitTx.amount;
    await wallet.increment('balance', { by: refundAmount, transaction });

    await WalletTransaction.create({
      id: uuid.v4(),
      walletId: wallet.id,
      amount: refundAmount,
      type: 'CREDIT',
      description: `Refund: Gold Coins (Booking Cancelled) - ${bookingId}`,
      referenceId: bookingId
    }, { transaction });

    console.log(`Refunded ${refundAmount} Gold Coins for booking ${bookingId}`);
  } catch (error) {
    console.error(`Refund Error for ${bookingId}:`, error.message);
    // We don't throw here to avoid failing the main cancellation flow, just log it.
  }
};

/**
 * Cancel an unpaid booking (called when user abandons payment)
 * Only cancels if paymentStatus is still 'pending' — paid bookings are never touched.
 */
const cancelUnpaidBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ message: 'bookingId required' });

    const booking = await CabBookingRequest.findOne({ where: { bookingId } });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Safety: only cancel if payment was never completed
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Booking is already paid. Cannot cancel via this endpoint.' });
    }

    const t = await sequelize.transaction();
    try {
      await CabBookingRequest.update(
        { status: 'cancelled' },
        { where: { bookingId, paymentStatus: 'pending' }, transaction: t }
      );

      // --- 🪙 REFUND COINS ---
      await refundBookingCoins(bookingId, t);

      await t.commit();
      res.status(200).json({ message: 'Unpaid booking cancelled and coins refunded (if any).' });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Cancel Unpaid Booking Error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getCabAvailability,
  searchForCabs,
  bookCab,
  addCab,
  estimatePrice,
  getEstimate,
  verifyDriverOtp,
  driverKeepAlive,
  addDriver,
  assignDriverToVehicle,
  updateDriverDeviceToken,
  login,
  getBulkEstimates,
  getDriver,
  checkBookingStatus,
  acceptBooking,
  createSoftBooking,
  checkPendingBookings,
  startTrip,
  endTrip,
  superhostAssignDriver,
  confirmBankPayment,
  trackDriverLocation,
  toggleDriverStatus,
  cancelUnpaidBooking,
  refundBookingCoins
};
