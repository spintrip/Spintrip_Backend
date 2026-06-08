const geolib = require("geolib");
const { Cab, Vehicle, VehicleAdditional, Driver, User } = require("../Models");
const dispatchEngine = require("./dispatchEngine");

// Map to store online users/drivers: userId -> { socketId, role }
const onlineUsers = new Map();
// Reverse map: socketId -> userId
const socketToUser = new Map();

// Map to track rejected drivers: bookingId -> Set of driverIds
const bookingRejections = new Map();

let ioInstance = null;

/**
 * Initialize Socket.IO manager
 * @param {object} io - Socket.IO Server instance
 */
function init(io) {
  ioInstance = io;

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Register user with their ID and Role
    socket.on("register", (data) => {
      const { userId, role } = data;
      if (!userId) return;

      // Store in online maps
      onlineUsers.set(userId, { socketId: socket.id, role });
      socketToUser.set(socket.id, userId);

      socket.userId = userId;
      socket.role = role;

      console.log(`Registered user ${userId} (${role}) on socket ${socket.id}`);

      // If driver connects, mark them active in database (heartbeat)
      if (role?.toLowerCase() === "driver") {
        Driver.update(
          { isActive: true, lastPingTime: new Date() },
          { where: { id: userId } }
        ).catch((err) => console.error("Error setting driver active in DB:", err.message));
      }
    });

    // Listen to real-time driver location updates
    socket.on("driver_location_update", async (data) => {
      const { latitude, longitude, bearing, bookingId } = data;
      const driverId = socket.userId || socketToUser.get(socket.id);

      if (!driverId) return;

      // Update DB coordinates
      try {
        const cab = await Cab.findOne({ where: { driverId } });
        if (cab) {
          await VehicleAdditional.update(
            { 
              latitude: parseFloat(latitude), 
              longitude: parseFloat(longitude), 
              timestamp: new Date() 
            },
            { where: { vehicleid: cab.vehicleid } }
          );
        }
      } catch (err) {
        console.error(`Error updating driver DB coordinates via socket: ${err.message}`);
      }

      // Broadcast location instantly to the trip room booking_${bookingId}
      if (bookingId) {
        io.to(`booking_${bookingId}`).emit("location_update", {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          bearing: parseFloat(bearing || 0.0),
          driverId,
          bookingId,
          timestamp: new Date()
        });
      }
    });

    // Customer joins a ride tracking room
    socket.on("join_ride", (data) => {
      const { bookingId } = data;
      if (bookingId) {
        socket.join(`booking_${bookingId}`);
        console.log(`Socket ${socket.id} joined room booking_${bookingId}`);
      }
    });

    // Customer leaves a ride tracking room
    socket.on("leave_ride", (data) => {
      const { bookingId } = data;
      if (bookingId) {
        socket.leave(`booking_${bookingId}`);
        console.log(`Socket ${socket.id} left room booking_${bookingId}`);
      }
    });

    // Disconnect handler
    socket.on("disconnect", () => {
      const userId = socketToUser.get(socket.id);
      if (userId) {
        const userSession = onlineUsers.get(userId);
        if (userSession && userSession.role?.toLowerCase() === "driver") {
          // Keep active for a brief grace period (e.g. in case of temporary disconnects)
          // or toggle offline immediately based on your preference.
          // Let's set inactive after 1 minute of disconnection, but keep in-memory mapping updated.
          console.log(`Driver ${userId} disconnected from socket.`);
        }
        onlineUsers.delete(userId);
        socketToUser.delete(socket.id);
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

/**
 * Get active socket ID of a user
 * @param {string} userId 
 * @returns {string|null}
 */
function getUserSocket(userId) {
  const session = onlineUsers.get(userId);
  return session ? session.socketId : null;
}

/**
 * Send event directly to a user's socket
 * @param {string} userId 
 * @param {string} eventName 
 * @param {object} payload 
 */
function sendToUser(userId, eventName, payload) {
  if (!ioInstance) return false;
  const socketId = getUserSocket(userId);
  if (socketId) {
    ioInstance.to(socketId).emit(eventName, payload);
    return true;
  }
  return false;
}

/**
 * Broadcast dynamic booking request to matching online drivers within radius rings
 * @param {object} booking - Booking instance
 * @param {object} pickupLocation - { latitude, longitude, address }
 */
async function broadcastBookingToDrivers(booking, pickupLocation) {
  if (!ioInstance) return;

  const { bookingId, cabType, estimatedPrice, bookingType, days, hours, isRoundTrip } = booking;
  const pickupLatitude = parseFloat(pickupLocation.latitude);
  const pickupLongitude = parseFloat(pickupLocation.longitude);

  console.log(`🚀 Starting Concentric Geofenced Broadcast for booking ${bookingId} (${cabType}) at coords [${pickupLatitude}, ${pickupLongitude}]`);

  // Get all online drivers
  const onlineDriverIds = [];
  for (const [userId, session] of onlineUsers.entries()) {
    if (session.role?.toLowerCase() === "driver") {
      onlineDriverIds.push(userId);
    }
  }

  if (onlineDriverIds.length === 0) {
    console.log("[DispatchEngine] No drivers currently connected via socket.");
    return;
  }

  const payload = {
    bookingId,
    pickup: pickupLocation,
    destination: {
      latitude: booking.endLocationLatitude,
      longitude: booking.endLocationLongitude,
      address: booking.endLocationAddress
    },
    estimatedPrice,
    bookingType,
    cabType,
    days: days || 1,
    hours: hours || 1,
    isRoundTrip: isRoundTrip !== false
  };

  const notifiedDrivers = new Set();

  // Helper function to broadcast to a list of matched driver candidates for a specific stage
  async function runStageBroadcast(stageNum, priorityLabel) {
    try {
      // 1. Double check booking is still pending before broadcasting next stage
      const currentBooking = await booking.constructor.findByPk(bookingId);
      if (!currentBooking || currentBooking.status !== "pending") {
        console.log(`[DispatchEngine] Booking ${bookingId} is no longer pending (status: ${currentBooking?.status}). Stopping concentric loop.`);
        return false;
      }

      const rejectedDrivers = getRejectedDriversForBooking(bookingId);
      const activeOnlineDriverIds = onlineDriverIds.filter(id => !rejectedDrivers.has(id));

      const matchedCandidates = await dispatchEngine.getMatchingDriversForStage(booking, pickupLocation, activeOnlineDriverIds, stageNum);
      
      if (matchedCandidates.length === 0) {
        console.log(`[DispatchEngine] Stage ${stageNum} (${priorityLabel}): No new drivers matched.`);
        return true;
      }

      console.log(`[DispatchEngine] Stage ${stageNum} (${priorityLabel}): Broadcasting to ${matchedCandidates.length} drivers...`);

      matchedCandidates.forEach(candidate => {
        sendToUser(candidate.driverId, "booking_broadcast", { 
          ...payload, 
          priority: priorityLabel, 
          distance: candidate.distance,
          drs: candidate.drs,
          dps: candidate.dps 
        });
        notifiedDrivers.add(candidate.driverId);
        console.log(`[DispatchEngine] Stage ${stageNum} alert sent to driver ${candidate.driverId} (Dist: ${candidate.distance.toFixed(2)} km, DRS: ${candidate.drs.toFixed(1)}, DPS: ${candidate.dps.toFixed(2)})`);
      });

      return true;
    } catch (stageErr) {
      console.error(`[DispatchEngine] Error in Stage ${stageNum} broadcast:`, stageErr.message);
      return true; // continue next stages on failure
    }
  }

  try {
    // --- STAGE 1: 0-3km (10 seconds duration) ---
    const continueDispatch = await runStageBroadcast(1, "high");
    if (!continueDispatch) return;

    // --- STAGE 2: 3-6km (15 seconds duration, triggers at 10s) ---
    setTimeout(async () => {
      const continueDispatch2 = await runStageBroadcast(2, "medium");
      if (!continueDispatch2) return;

      // --- STAGE 3: 6-12km (20 seconds duration, triggers at 25s) ---
      setTimeout(async () => {
        const continueDispatch3 = await runStageBroadcast(3, "low");
        if (!continueDispatch3) return;

        // --- AUTO-EXPIRY: Triggers at 55 seconds (10s + 15s + 30s) ---
        setTimeout(async () => {
          const finalBookingState = await booking.constructor.findByPk(bookingId);
          if (finalBookingState && finalBookingState.status === "pending") {
            await finalBookingState.update({ status: "cancelled" });
            console.log(`[DispatchEngine] Booking request ${bookingId} auto-expired due to driver timeout.`);
            
            // Notify customer app
            ioInstance.to(`booking_${bookingId}`).emit("booking_expired", { bookingId });
            
            // Dismiss broadcast dialogs for all notified drivers
            notifiedDrivers.forEach(driverId => {
              sendToUser(driverId, "booking_unavailable", { bookingId });
            });
          }
        }, 30000); // 30 seconds wait in Stage 3 before final auto-expiry

      }, 15000); // 15 seconds wait in Stage 2 before Stage 3

    }, 10000); // 10 seconds wait in Stage 1 before Stage 2

  } catch (err) {
    console.error("Error in Concentric Stage Geofenced Broadcast:", err.message);
  }
}

/**
 * Cancel driver dialogs once a ride has been accepted
 * @param {string} bookingId 
 * @param {string} acceptedDriverId 
 */
async function cancelBroadcasts(bookingId, acceptedDriverId) {
  if (!ioInstance) return;

  // Clean up rejections map
  bookingRejections.delete(bookingId);

  // Broadly broadcast 'booking_unavailable' to all drivers so their screens clear and alarms stop
  for (const [userId, session] of onlineUsers.entries()) {
    if (session.role?.toLowerCase() === "driver" && userId !== acceptedDriverId) {
      sendToUser(userId, "booking_unavailable", { bookingId });
    }
  }
  console.log(`Cancelled alert broadcasts for booking ${bookingId} to all drivers except ${acceptedDriverId}`);
}

function rejectBroadcastForDriver(bookingId, driverId) {
  if (!bookingRejections.has(bookingId)) {
    bookingRejections.set(bookingId, new Set());
  }
  bookingRejections.get(bookingId).add(driverId);

  // Send booking_unavailable to this driver ONLY, so they clear their sheet/alarm locally
  sendToUser(driverId, "booking_unavailable", { bookingId });
  console.log(`Driver ${driverId} rejected booking ${bookingId}. Closed sheet for this driver.`);
}

function getRejectedDriversForBooking(bookingId) {
  return bookingRejections.get(bookingId) || new Set();
}

module.exports = {
  init,
  onlineUsers,
  getUserSocket,
  sendToUser,
  broadcastBookingToDrivers,
  cancelBroadcasts,
  rejectBroadcastForDriver,
  getRejectedDriversForBooking
};
