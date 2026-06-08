const geolib = require("geolib");
const { Cab, Vehicle, VehicleAdditional, Driver, User, AirportQueue } = require("../Models");
const { Op } = require("sequelize");

// Mapped coordinates for major Indian airports to support FIFO queueing
const AIRPORTS = [
  { code: "BLR", name: "Bengaluru Kempegowda Airport", latitude: 13.1986, longitude: 77.7066 },
  { code: "CCU", name: "Kolkata Netaji Subhash Airport", latitude: 22.6520, longitude: 88.4467 },
  { code: "HYD", name: "Hyderabad Rajiv Gandhi Airport", latitude: 17.2403, longitude: 78.4294 }
];

/**
 * Calculate dynamic Driver Reliability Score (DRS)
 * DRS = (Acceptance Rate * 40%) + ((100 - Cancellation Rate) * 40%) + (On-Time Arrival Rate * 20%)
 * In standard setup, if fields don't exist, we fall back to high priority default (e.g. 95)
 */
function calculateDRS(driver) {
  const acceptanceRate = parseFloat(driver.acceptanceRate ?? 100);
  const cancellationRate = parseFloat(driver.cancellationRate ?? 0);
  const onTimeRate = parseFloat(driver.onTimeRate ?? 100);

  const drs = (acceptanceRate * 0.40) + ((100 - cancellationRate) * 0.40) + (onTimeRate * 0.20);
  return Math.min(100, Math.max(0, drs));
}

/**
 * Concentric Stage-Based Dispatch Matching
 * @param {object} booking - Booking instance
 * @param {object} pickupLocation - { latitude, longitude }
 * @param {Array} onlineDriverIds - list of online driver IDs from socket session
 * @param {number} stage - 1 (0-3km), 2 (3-6km), 3 (6-12km)
 */
async function getMatchingDriversForStage(booking, pickupLocation, onlineDriverIds, stage) {
  try {
    const pickupLat = parseFloat(pickupLocation.latitude);
    const pickupLng = parseFloat(pickupLocation.longitude);

    // --- AIRPORT COMMAND QUEUE CHECK (ONLY FOR STAGE 1 DISPATCH TO PREVENT REPEATED QUERIES) ---
    if (stage === 1 && booking.bookingType === "Airport") {
      // Check if pickup is within 3km of one of our mapped airports
      let matchedAirport = null;
      for (const airport of AIRPORTS) {
        const dist = geolib.getDistance(
          { latitude: pickupLat, longitude: pickupLng },
          { latitude: airport.latitude, longitude: airport.longitude }
        );
        if (dist <= 3000) { // 3km geofence
          matchedAirport = airport;
          break;
        }
      }

      if (matchedAirport) {
        console.log(`[AirportCommandCenter] Match detected at ${matchedAirport.name} (${matchedAirport.code}). Checking waiting FIFO queue...`);
        
        // Find the first driver in queue who is currently online
        const queueEntry = await AirportQueue.findOne({
          where: { airportCode: matchedAirport.code, status: "waiting" },
          order: [["queuePosition", "ASC"]]
        });

        if (queueEntry) {
          if (onlineDriverIds.includes(queueEntry.driverId)) {
            console.log(`[AirportCommandCenter] Dispatching directly to queued driver ${queueEntry.driverId} at position ${queueEntry.queuePosition}.`);
            
            // Mark queue entry as "offered" to prevent double offers
            queueEntry.status = "offered";
            await queueEntry.save();

            const driver = await Driver.findOne({ where: { id: queueEntry.driverId } });
            const drs = driver ? calculateDRS(driver) : 95.0;

            return [{
              driverId: queueEntry.driverId,
              distance: 0.1,
              drs,
              dps: 0.0 // highest possible priority
            }];
          } else {
            console.log(`[AirportCommandCenter] Queued driver ${queueEntry.driverId} is offline. Falling back to dynamic geofenced matching.`);
          }
        } else {
          console.log(`[AirportCommandCenter] Airport queue for ${matchedAirport.code} is currently empty. Falling back to dynamic geofenced matching.`);
        }
      }
    }

    // Determine distance boundaries based on concentric ring stages
    let minDistance = 0;
    let maxDistance = 3.0; // km

    if (stage === 2) {
      minDistance = 3.0;
      maxDistance = 6.0;
    } else if (stage === 3) {
      minDistance = 6.0;
      maxDistance = 12.0;
    }

    console.log(`[DispatchEngine] Finding drivers for booking ${booking.bookingId} in Stage ${stage} (${minDistance} - ${maxDistance} km)...`);

    // Fetch active cabs for online drivers with location coordinates
    const activeCabs = await Cab.findAll({
      where: { driverId: onlineDriverIds },
      include: [{
        model: Vehicle,
        required: true,
        include: [{
          model: VehicleAdditional,
          required: true,
          attributes: ["vehicleid", "latitude", "longitude"]
        }]
      }]
    });

    const candidateDrivers = [];

    for (const cab of activeCabs) {
      if (cab.Vehicle && cab.Vehicle.VehicleAdditional) {
        const vLat = parseFloat(cab.Vehicle.VehicleAdditional.latitude);
        const vLng = parseFloat(cab.Vehicle.VehicleAdditional.longitude);

        if (isNaN(vLat) || isNaN(vLng)) continue;

        // Geolib gets distance in meters
        const distanceMeters = geolib.getDistance(
          { latitude: pickupLat, longitude: pickupLng },
          { latitude: vLat, longitude: vLng }
        );
        const distanceKm = distanceMeters / 1000.0;

        if (distanceKm >= minDistance && distanceKm <= maxDistance) {
          // Fetch Driver for Reliability Score & Preferences
          const driver = await Driver.findOne({ where: { id: cab.driverId } });
          if (!driver) continue;

          // --- CORPORATE FILTERING ---
          const bookingIsCorporate = booking.isCorporate === true;
          const driverIsCorporate = driver.isCorporate === true;
          if (bookingIsCorporate !== driverIsCorporate) {
            console.log(`[DispatchEngine] Skipping driver ${cab.driverId} due to corporate mismatch (Booking: ${bookingIsCorporate}, Driver: ${driverIsCorporate})`);
            continue;
          }

          // --- DRIVER PREFERENCE FILTERING ---
          const preference = driver.preference || "All";
          const bookingTypeStr = booking.bookingType || "Local";

          if (preference !== "All") {
            if (preference === "Airport Only" && bookingTypeStr !== "Airport") {
              console.log(`[DispatchEngine] Skipping driver ${cab.driverId} due to Airport-Only preference (Booking is ${bookingTypeStr})`);
              continue;
            }
            if (preference === "Local Only" && bookingTypeStr !== "Local") {
              console.log(`[DispatchEngine] Skipping driver ${cab.driverId} due to Local-Only preference (Booking is ${bookingTypeStr})`);
              continue;
            }
            if (preference === "Outstation Only" && bookingTypeStr !== "Outstation") {
              console.log(`[DispatchEngine] Skipping driver ${cab.driverId} due to Outstation-Only preference (Booking is ${bookingTypeStr})`);
              continue;
            }
            if (preference === "Rentals Only" && bookingTypeStr !== "Rentals") {
              console.log(`[DispatchEngine] Skipping driver ${cab.driverId} due to Rentals-Only preference (Booking is ${bookingTypeStr})`);
              continue;
            }
          }

          const drs = calculateDRS(driver);

          // Dispatch Priority Score (DPS) formula
          // DPS = (0.50 * Distance) + (0.30 * (100 - DRS))
          const dps = (0.50 * distanceKm) + (0.30 * (100 - drs));

          candidateDrivers.push({
            driverId: cab.driverId,
            distance: distanceKm,
            drs,
            dps
          });
        }
      }
    }

    // Sort drivers ascending by DPS (lower DPS = higher priority / closer / more reliable)
    candidateDrivers.sort((a, b) => a.dps - b.dps);

    console.log(`[DispatchEngine] Found ${candidateDrivers.length} matched drivers in Stage ${stage}.`);
    return candidateDrivers;

  } catch (err) {
    console.error("[DispatchEngine] Error matching drivers:", err.message);
    return [];
  }
}

module.exports = {
  calculateDRS,
  getMatchingDriversForStage
};
