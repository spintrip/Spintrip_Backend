const uuid = require("uuid");
const { CabBookingRequest, User, CabBookingAccepted, Wallet, WalletTransaction, sequelize, Vehicle, Cab, VehicleAdditional, Driver, DriverAdditional, Tax, AgentWallet, AgentWalletTransaction, HostPayment, Subscriptions } = require("../Models");
const { Op } = require("sequelize");
const socketManager = require("../Utils/socketManager");

/**
 * Create a manual booking by an Agent
 */
const createAgentBooking = async (req, res) => {
  const { 
    customerName, 
    customerPhone, 
    pickupAddress, 
    pickupLat, 
    pickupLng, 
    dropAddress, 
    dropLat, 
    dropLng, 
    bookingType, // "Local", "Airport", "Rentals", "Outstation"
    cabType,     // "Mini", "Sedan", "SUV", etc.
    estimatedPrice, 
    date, 
    time,
    hours,
    rentalHours,
    days,
    outstationDays,
    isCorporate
  } = req.body;

  const agentId = req.user.id; // Authenticated agent
  const fare = parseFloat(estimatedPrice || 100);

  // We run this inside an atomic database transaction to prevent double spending
  const t = await sequelize.transaction();

  try {
    if (!customerPhone || !pickupAddress || !pickupLat || !pickupLng || !bookingType) {
      await t.rollback();
      return res.status(400).json({ message: "Missing required booking details." });
    }

    // 1. Fetch or create AgentWallet for backward compatibility
    let wallet = await AgentWallet.findOne({ where: { agentId }, transaction: t });
    if (!wallet) {
      wallet = await AgentWallet.create({
        agentId,
        balance: 100.0, // Pre-loaded with 100 coins balance
        creditLimit: 5000.0,
        outstandingCredit: 0.0,
        escrowBalance: 0.0
      }, { transaction: t });
      console.log(`[AgentWallet] Initialized default trial wallet for Agent ${agentId}`);
    }

    // 2. Validate sufficient available balance + credit line
    const availableCreditLine = wallet.creditLimit - wallet.outstandingCredit;
    const totalAvailable = wallet.balance + availableCreditLine;

    if (totalAvailable < fare) {
      await t.rollback();
      return res.status(400).json({ 
        message: `Insufficient balance and credit line to create booking. Total available: ₹${totalAvailable.toFixed(2)} (Fare: ₹${fare.toFixed(2)})` 
      });
    }

    // 3. Deduct fare from wallet ledger
    if (wallet.balance >= fare) {
      wallet.balance -= fare;
    } else {
      const remainingFare = fare - wallet.balance;
      wallet.balance = 0.0;
      wallet.outstandingCredit += remainingFare;
    }
    await wallet.save({ transaction: t });

    // 4. Find or create the customer by phone number
    let customer = await User.findOne({ where: { phone: customerPhone }, transaction: t });
    if (!customer) {
      const customerId = uuid.v4();
      customer = await User.create({
        id: customerId,
        phone: customerPhone,
        password: "1234", // Default initial password
        role: "user"
      }, { transaction: t });
      console.log(`Created new customer account for phone ${customerPhone}`);
    }

    const bookingId = uuid.v4();
    const rideOtp = Math.floor(1000 + Math.random() * 9000);

    // 5. Create the CabBookingRequest record
    const booking = await CabBookingRequest.create({
      bookingId,
      userId: customer.id, // Booked for this customer
      agentId: agentId,    // Created by this agent
      date: date || new Date().toISOString().split('T')[0],
      time: time || new Date().toTimeString().split(' ')[0],
      startLocationLatitude: parseFloat(pickupLat),
      startLocationLongitude: parseFloat(pickupLng),
      startLocationAddress: pickupAddress,
      endLocationLatitude: dropLat ? parseFloat(dropLat) : parseFloat(pickupLat),
      endLocationLongitude: dropLng ? parseFloat(dropLng) : parseFloat(pickupLng),
      endLocationAddress: dropAddress || pickupAddress,
      estimatedPrice: fare,
      subtotalBasePrice: fare / 1.05,
      gstAmount: fare - (fare / 1.05),
      status: "pending",
      paymentStatus: "paid", // Auto-mark paid for agent direct bookings (assume settled manually)
      cabType: cabType || "Mini",
      bookingType: bookingType || "Local",
      otp: rideOtp,
      confirmationFee: 0.0,
      payToDriver: fare,
      hours: hours || rentalHours || 1,
      days: days || outstationDays || 1,
      isCorporate: isCorporate === true || isCorporate === 'true' || false
    }, { transaction: t });

    // 6. Create Agent Wallet Transaction log
    await AgentWalletTransaction.create({
      walletId: wallet.id,
      amount: -fare,
      type: "payment",
      referenceId: bookingId,
      description: `Ride booking deduction for OTP: ${rideOtp}`
    }, { transaction: t });

    console.log(`Created Agent Manual Booking ${bookingId} for customer ${customer.id}`);

    await t.commit();

    // 7. Increment broadcastsUsed on the agent's active subscription (ALWAYS - even if no driver accepts)
    let broadcastsUsed = null;
    let broadcastsRemaining = null;
    try {
      const { HostPayment, Subscriptions } = require('../Models');
      const activeSub = await HostPayment.findOne({
        where: {
          HostId: agentId,
          PlanEndDate: { [require('sequelize').Op.gt]: new Date() }
        },
        order: [['PlanEndDate', 'DESC']]
      });
      if (activeSub) {
        activeSub.broadcastsUsed = (activeSub.broadcastsUsed || 0) + 1;
        await activeSub.save();
        const plan = await Subscriptions.findOne({ where: { PlanType: activeSub.PlanType } });
        const allowed = plan?.broadcasts ?? null;
        broadcastsUsed = activeSub.broadcastsUsed;
        broadcastsRemaining = allowed !== null ? Math.max(0, allowed - broadcastsUsed) : null;
        console.log(`[Broadcast] Incremented broadcastsUsed to ${broadcastsUsed} for Agent ${agentId} (Sub: ${activeSub.PaymentId})`);
      }
    } catch (subErr) {
      console.error('[Broadcast] Failed to increment broadcastsUsed:', subErr.message);
    }

    // 8. Trigger Nearby Geofenced Broadcast via Sockets
    const pickupLocation = {
      latitude: parseFloat(pickupLat),
      longitude: parseFloat(pickupLng),
      address: pickupAddress
    };
    
    // Asynchronously trigger geofenced driver pings so the API remains lightning fast
    socketManager.broadcastBookingToDrivers(booking, pickupLocation).catch(err => {
      console.error("Failed to broadcast booking:", err.message);
    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully and broadcasted to nearby drivers.",
      bookingId,
      otp: rideOtp,
      wallet: {
        balance: wallet.balance,
        creditLimit: wallet.creditLimit,
        outstandingCredit: wallet.outstandingCredit
      },
      subscription: {
        broadcastsUsed,
        broadcastsRemaining
      }
    });

  } catch (error) {
    await t.rollback();
    console.error("Error creating agent booking:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Retrieve performance stats and analytics for the authenticated Agent
 */
const getAgentPerformance = async (req, res) => {
  const agentId = req.user.id;

  try {
    // 1. Fetch all bookings created by this agent
    const bookings = await CabBookingRequest.findAll({
      where: { agentId }
    });

    // 2. Compute performance metrics
    const totalBookings = bookings.length;
    let totalRevenue = 0.0;
    let completedTrips = 0;
    let activeBookings = 0;

    bookings.forEach(b => {
      totalRevenue += parseFloat(b.estimatedPrice || 0);
      if (b.status === "completed") {
        completedTrips += 1;
      }
      if (b.status === "pending" || b.status === "accepted" || b.status === "started") {
        activeBookings += 1;
      }
    });

    // 3. Compute monthly statistics for Chart.js
    // Group bookings by Month-Year over the last 12 months
    const monthlyStatsMap = {};
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    bookings.forEach(b => {
      if (b.createdAt) {
        const dateObj = new Date(b.createdAt);
        const label = `${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        if (!monthlyStatsMap[label]) {
          monthlyStatsMap[label] = { bookingsCount: 0, revenue: 0.0 };
        }
        monthlyStatsMap[label].bookingsCount += 1;
        monthlyStatsMap[label].revenue += parseFloat(b.estimatedPrice || 0);
      }
    });

    // Format monthly data for easy frontend rendering
    const monthlyLabels = Object.keys(monthlyStatsMap).slice(-6); // Limit to last 6 active months
    const monthlyBookingsData = monthlyLabels.map(label => monthlyStatsMap[label].bookingsCount);
    const monthlyRevenueData = monthlyLabels.map(label => Math.round(monthlyStatsMap[label].revenue));

    res.status(200).json({
      success: true,
      performance: {
        totalBookings,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        completedTrips,
        activeBookings
      },
      chartData: {
        labels: monthlyLabels.length > 0 ? monthlyLabels : ["Current Month"],
        bookings: monthlyBookingsData.length > 0 ? monthlyBookingsData : [totalBookings],
        revenue: monthlyRevenueData.length > 0 ? monthlyRevenueData : [Math.round(totalRevenue)]
      }
    });

  } catch (error) {
    console.error("Error retrieving agent performance:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Retrieve bookings created by the authenticated Agent
 */
const getAgentBookings = async (req, res) => {
  const agentId = req.user.id;
  try {
    const cabBookings = await CabBookingRequest.findAll({
      where: { agentId },
      order: [["createdAt", "DESC"]]
    });

    const taxRow = await Tax.findOne({ order: [['createdAt', 'DESC']] });
    const GST_RATE = taxRow ? taxRow.GST : 5.0;
    const COMMISSION_RATE = taxRow ? (taxRow.Commission || 20.0) : 20.0;
    const TDS_RATE = taxRow ? taxRow.TDS : 1.0;

    const noVehicleImg = `https://spintrip-s3bucket.s3.ap-south-1.amazonaws.com/vehicleAdditional/no_image.png`;

    const formattedBookings = await Promise.all(cabBookings.map(async (cab) => {
      const vehicle = cab.vehicleId ? await Vehicle.findOne({ where: { vehicleid: cab.vehicleId } }) : null;
      let vehicleModel = cab.cabType || "Mini Cab";
      let vehicleImage1 = noVehicleImg;
      if (vehicle) {
        const cabData = await Cab.findOne({ where: { vehicleid: vehicle.vehicleid } });
        const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: vehicle.vehicleid } });
        if (cabData && cabData.brand) vehicleModel = cabData.brand.charAt(0).toUpperCase() + cabData.brand.slice(1).toLowerCase();
        if (vehicleAdditional && vehicleAdditional.vehicleimage1) vehicleImage1 = vehicleAdditional.vehicleimage1;
      }

      let pickupObj = {
        latitude: cab.startLocationLatitude || 0,
        longitude: cab.startLocationLongitude || 0,
        address: cab.startLocationAddress || ""
      };
      let destObj = {
        latitude: cab.endLocationLatitude || 0,
        longitude: cab.endLocationLongitude || 0,
        address: cab.endLocationAddress || ""
      };

      // Map Status string to Int (1=Upcoming, 2=Ongoing, 3=Complete, 4=Cancelled, 5=Confirmed, 6=Reviewed)
      let intStatus = 5; // Default Booking Confirmed / Pending
      if (cab.status === 'accepted' || cab.status === 'assigned') intStatus = 1;
      if (cab.status === 'started' || cab.status === 'ongoing') intStatus = 2;
      if (cab.status === 'completed') intStatus = 3;
      if (cab.status === 'cancelled' || cab.paymentStatus === 'failed') intStatus = 4;
      if (cab.status === 'rated') intStatus = 6;

      let cabDriver = null;
      const did = cab.driverid || cab.driverId;
      if (did) {
        const driverData = await Driver.findOne({ where: { id: did } });
        const driverAdditional = await DriverAdditional.findOne({ where: { id: did } });
        const driverPhoneUser = await User.findOne({ where: { id: did } });
        if (driverData) {
          cabDriver = {
            id: driverData.id,
            name: driverAdditional?.FullName || driverData.name || null,
            phone: driverPhoneUser?.phone || driverData.phoneNumber || driverData.phone || null
          };
        }
      }

      const amt = cab.estimatedPrice || cab.finalPrice || 0;
      const netBaseAmount = amt / (1 + (GST_RATE / 100));
      const gstOut = amt - netBaseAmount;
      const commOut = netBaseAmount * (COMMISSION_RATE / 100);
      const tdsOut = netBaseAmount * (TDS_RATE / 100); // 1% Gross
      const dEarn = Math.round((netBaseAmount - commOut - tdsOut) * 100) / 100;

      const dateStr = cab.date || (cab.createdAt ? cab.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      const timeStr = cab.time || (cab.createdAt ? cab.createdAt.toISOString().split('T')[1].slice(0, 5) : new Date().toTimeString().split(' ')[0].slice(0, 5));

      const otpRecord = await CabBookingAccepted.findOne({ where: { bookingId: cab.bookingId } });
      const otpVal = otpRecord?.tripOtp || cab.otp || "0000";

      return {
        agentId: cab.agentId,
        bookingId: cab.bookingId,
        vehicleid: cab.vehicleId || "",
        id: cab.userId,
        status: intStatus,
        amount: amt,
        gstAmount: Math.round(gstOut * 100) / 100,
        commissionAmount: Math.round(commOut * 100) / 100,
        tdsAmount: Math.round(tdsOut * 100) / 100,
        driverEarnings: dEarn,
        confirmationFee: cab.confirmationFee || 0.0,
        payToDriver: cab.payToDriver || dEarn,
        startTripDate: dateStr,
        endTripDate: dateStr,
        startTripTime: timeStr,
        endTripTime: cab.endTripTime || "00:00:00",
        hostId: vehicle ? vehicle.hostId : "",
        vehicleModel: vehicleModel,
        vehicletype: 3, // CAB Type
        vehicleImage1: vehicleImage1,
        vehicleImage2: noVehicleImg,
        vehicleImage3: noVehicleImg,
        vehicleImage4: noVehicleImg,
        vehicleImage5: noVehicleImg,
        latitude: cab.startLocationLatitude,
        longitude: cab.startLocationLongitude,
        cancelDate: null,
        cancelReason: null,
        features: [],
        pickup: pickupObj,
        destination: destObj,
        driver: cabDriver,
        rcNumber: vehicle ? vehicle.Rcnumber : "Not Provided",
        userOtp: otpVal,
        transaction: (cab.paymentStatus && cab.paymentStatus.toLowerCase() === 'paid') ? { transactionId: cab.bookingId, status: 1 } : null,
        createdAt: cab.createdAt
      };
    }));

    res.status(200).json({
      success: true,
      bookings: formattedBookings
    });
  } catch (error) {
    console.error("Error retrieving agent bookings:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Add a new driver or link an existing driver to the authenticated Agent
 */
const postAgentDriver = async (req, res) => {
  try {
    const agentId = req.user.id;
    const phone = (req.body.phone || '').toString().trim();
    const fullName = (req.body.fullName || '').toString().trim();
    const aadharId = (req.body.aadharId || '').toString().trim();
    const email = (req.body.email || '').toString().trim();
    const address = (req.body.address || '').toString().trim();
    const upiId = (req.body.upiId || '').toString().trim();
    const bankAccountNumber = (req.body.bankAccountNumber || '').toString().trim();

    if (!phone || !fullName) {
      return res.status(400).json({ message: 'phone and fullName required' });
    }

    const existingUser = await User.findOne({ where: { phone } });

    const upsertAdditional = async (driverId) => {
      const values = {
        id: driverId,
        ...(fullName && { FullName: fullName }),
        ...(aadharId && { AadharVfid: aadharId }),
        ...(email && { Email: email }),
        ...(address && { Address: address }),
      };
      const found = await DriverAdditional.findOne({ where: { id: driverId } });
      if (found) {
        if (Object.keys(values).length > 1) {
          await DriverAdditional.update(values, { where: { id: driverId } });
        }
        return DriverAdditional.findOne({ where: { id: driverId } });
      }
      return DriverAdditional.create({
        id: driverId,
        FullName: fullName || 'Not Provided',
        AadharVfid: aadharId || 'Not Provided',
        Email: email || 'Not Provided',
        Address: address || 'Not Provided',
        profilepic: null,
        aadhar: null
      });
    };

    if (existingUser) {
      const driverRow = await Driver.findOne({ where: { id: existingUser.id } });

      if (driverRow) {
        // Reassign driver if detached or updating billing
        if (!driverRow.hostid || upiId || bankAccountNumber) {
          await driverRow.update({
            hostid: agentId,
            ...(upiId && { upiId }),
            ...(bankAccountNumber && { bankAccountNumber })
          });
        } else if (driverRow.hostid !== agentId) {
          return res.status(400).json({
            message: "Driver already assigned to another partner/agent"
          });
        }

        await upsertAdditional(existingUser.id);
        const updated = await DriverAdditional.findOne({ where: { id: existingUser.id } });

        return res.status(200).json({
          message: "Driver reactivated successfully",
          driver: updated
        });
      }

      await Driver.create({ id: existingUser.id, hostid: agentId, upiId: upiId || null, bankAccountNumber: bankAccountNumber || null });
      await upsertAdditional(existingUser.id);

      const created = await DriverAdditional.findOne({ where: { id: existingUser.id } });
      return res.status(201).json({ message: 'Driver created for existing user', driver: created });
    }

    // new user -> create user, driver, additional
    const userId = uuid.v4();
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('1234', bcrypt.genSaltSync(10));

    await User.create({ id: userId, phone, password: hashedPassword, role: 'driver' });
    await Driver.create({ id: userId, hostid: agentId, upiId: upiId || null, bankAccountNumber: bankAccountNumber || null });
    await DriverAdditional.create({
      id: userId,
      FullName: fullName || 'Not Provided',
      AadharVfid: aadharId || 'Not Provided',
      Email: email || 'Not Provided',
      Address: address || 'Not Provided',
    });

    const driver = await DriverAdditional.findOne({ where: { id: userId } });
    return res.status(201).json({ message: 'Driver created successfully', driver });

  } catch (err) {
    console.error('postAgentDriver error', err);
    return res.status(500).json({ message: 'Error creating driver', error: err.message || err });
  }
};

/**
 * Retrieve all drivers linked to the authenticated Agent
 */
const getAgentDrivers = async (req, res) => {
  try {
    const agentId = req.user.id;

    const drivers = await Driver.findAll({
      where: { hostid: agentId },
      include: [
        {
          model: User,
          attributes: ["phone", "role", "createdAt"],
        },
        {
          model: DriverAdditional,
          attributes: [
            "FullName",
            "Email",
            "AadharVfid",
            "Address",
            "profilepic",
            "aadhar",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      message: "Drivers fetched successfully",
      count: drivers.length,
      drivers,
    });
  } catch (error) {
    console.error("Error fetching agent drivers:", error);
    res.status(500).json({ message: "Error fetching drivers", error: error.message });
  }
};

/**
 * Detach a driver from the authenticated Agent
 */
const deleteAgentDriver = async (req, res) => {
  try {
    const driverId = req.params.id;
    const agentId = req.user.id;

    const driver = await Driver.findOne({
      where: {
        id: driverId,
        hostid: agentId,
      },
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    await driver.update({
      hostid: null
    });

    return res.status(200).json({
      success: true,
      message: "Driver unlinked successfully",
    });

  } catch (error) {
    console.error("Delete agent driver error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Upload driver files (Aadhar, Profile picture, DL, PAN) for a driver linked to the Agent
 */
const verifyAgentDriverProfile = async (req, res) => {
  try {
    const agentId = req.user.id;
    const driverId = req.body.id;

    if (!driverId) {
      return res.status(400).json({ message: "Driver id required" });
    }

    const driver = await Driver.findOne({
      where: {
        id: driverId,
        hostid: agentId
      }
    });

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found or not assigned to Agent"
      });
    }

    const { aadharFile, profilePic, dlFile, panFile } = req.files || {};

    if (profilePic && profilePic[0]) {
      await DriverAdditional.update(
        { profilepic: profilePic[0].location || null, verification_status: 1 },
        { where: { id: driverId } }
      );
    }

    if (dlFile && dlFile[0]) {
      await DriverAdditional.update(
        { dl: dlFile[0].location || null, verification_status: 1 },
        { where: { id: driverId } }
      );
    }

    if (aadharFile && aadharFile[0]) {
      await DriverAdditional.update(
        { aadhar: aadharFile[0].location || null, verification_status: 1 },
        { where: { id: driverId } }
      );
    }

    if (panFile && panFile[0]) {
      await DriverAdditional.update(
        { pan: panFile[0].location || null, verification_status: 1 },
        { where: { id: driverId } }
      );
    }

    res.status(200).json({ message: 'Driver profile files uploaded successfully' });
  } catch (error) {
    console.error("verifyAgentDriverProfile error:", error);
    res.status(500).json({ message: 'Error uploading driver profile files', error: error.message });
  }
};

/**
 * Get Travel Agent Wallet details and recent transaction ledger
 */
const getAgentWallet = async (req, res) => {
  const agentId = req.user.id;
  try {
    let wallet = await AgentWallet.findOne({ where: { agentId } });
    if (!wallet) {
      wallet = await AgentWallet.create({
        agentId,
        balance: 100.0, // Pre-loaded with 100 coins balance
        creditLimit: 5000.0,
        outstandingCredit: 0.0,
        escrowBalance: 0.0
      });
    }

    const transactions = await AgentWalletTransaction.findAll({
      where: { walletId: wallet.id },
      order: [["createdAt", "DESC"]],
      limit: 15
    });

    res.status(200).json({
      success: true,
      wallet: {
        id: wallet.id,
        agentId: wallet.agentId,
        balance: wallet.balance,
        creditLimit: wallet.creditLimit,
        outstandingCredit: wallet.outstandingCredit,
        escrowBalance: wallet.escrowBalance,
        availableFunds: wallet.balance + (wallet.creditLimit - wallet.outstandingCredit)
      },
      transactions
    });
  } catch (error) {
    console.error("Error fetching agent wallet:", error.message);
    res.status(500).json({ message: "Server error fetching wallet info", error: error.message });
  }
};

/**
 * Simulate/mock depositing funds to Agent Wallet (Zero Cost)
 */
const depositAgentWallet = async (req, res) => {
  const agentId = req.user.id;
  const { amount } = req.body;

  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: "Invalid deposit amount" });
  }

  const depositAmt = parseFloat(amount);
  const t = await sequelize.transaction();

  try {
    let wallet = await AgentWallet.findOne({ where: { agentId }, transaction: t });
    if (!wallet) {
      wallet = await AgentWallet.create({
        agentId,
        balance: 100.0,
        creditLimit: 5000.0,
        outstandingCredit: 0.0,
        escrowBalance: 0.0
      }, { transaction: t });
    }

    // Clear outstanding credit first if any
    let clearCredit = 0;
    let actualBalanceAdded = depositAmt;

    if (wallet.outstandingCredit > 0) {
      clearCredit = Math.min(wallet.outstandingCredit, depositAmt);
      wallet.outstandingCredit -= clearCredit;
      actualBalanceAdded = depositAmt - clearCredit;
    }

    wallet.balance += actualBalanceAdded;
    await wallet.save({ transaction: t });

    // Create deposit transaction ledger
    await AgentWalletTransaction.create({
      walletId: wallet.id,
      amount: depositAmt,
      type: "deposit",
      description: `Simulated wallet deposit. Cleared outstanding credit: ₹${clearCredit.toFixed(2)}`
    }, { transaction: t });

    await t.commit();

    res.status(200).json({
      success: true,
      message: `Deposit of ₹${depositAmt.toFixed(2)} completed successfully!`,
      wallet: {
        balance: wallet.balance,
        creditLimit: wallet.creditLimit,
        outstandingCredit: wallet.outstandingCredit,
        availableFunds: wallet.balance + (wallet.creditLimit - wallet.outstandingCredit)
      }
    });

  } catch (error) {
    await t.rollback();
    console.error("Error depositing to agent wallet:", error.message);
    res.status(500).json({ message: "Server error processing deposit", error: error.message });
  }
};

/**
 * Adjust Credit Limit for an Agent (Admin only)
 */
const adjustAgentCreditLimit = async (req, res) => {
  const { targetAgentId, newCreditLimit } = req.body;

  if (!targetAgentId || newCreditLimit === undefined || isNaN(newCreditLimit) || parseFloat(newCreditLimit) < 0) {
    return res.status(400).json({ message: "Invalid input. Target agent ID and new credit limit are required." });
  }

  const limit = parseFloat(newCreditLimit);
  const t = await sequelize.transaction();

  try {
    let wallet = await AgentWallet.findOne({ where: { agentId: targetAgentId }, transaction: t });
    if (!wallet) {
      wallet = await AgentWallet.create({
        agentId: targetAgentId,
        balance: 0.0,
        creditLimit: limit,
        outstandingCredit: 0.0,
        escrowBalance: 0.0
      }, { transaction: t });
    } else {
      wallet.creditLimit = limit;
      await wallet.save({ transaction: t });
    }

    await AgentWalletTransaction.create({
      walletId: wallet.id,
      amount: limit,
      type: "credit_adjustment",
      description: `Credit line limit adjusted to: ₹${limit.toFixed(2)}`
    }, { transaction: t });

    await t.commit();

    res.status(200).json({
      success: true,
      message: `Credit limit updated to ₹${limit.toFixed(2)} successfully for Agent ${targetAgentId}.`,
      wallet: {
        balance: wallet.balance,
        creditLimit: wallet.creditLimit,
        outstandingCredit: wallet.outstandingCredit
      }
    });

  } catch (error) {
    await t.rollback();
    console.error("Error adjusting credit limit:", error.message);
    res.status(500).json({ message: "Server error adjusting credit limit", error: error.message });
  }
};

const activateAgentSubscription = async (req, res) => {
  const { paymentMethod, planType } = req.body;
  const agentId = req.user.id;
  try {
    const subscription = await Subscriptions.findOne({ where: { PlanType: planType } });
    if (!subscription) {
      return res.status(404).json({ message: 'No Subscription record found' });
    }

    const expiryDays = subscription.expiry;
    const planEndDate = new Date();
    planEndDate.setDate(planEndDate.getDate() + expiryDays);
    const paymentId = uuid.v4();
    const amount = subscription.amount;

    const hostPayment = await HostPayment.create({
      PaymentId: paymentId,
      HostId: agentId,
      PlanType: planType,
      PaymentDate: new Date(),
      PlanEndDate: planEndDate,
      Amount: amount,
      GSTAmount: amount,
      TotalAmount: amount,
      PaymentStatus: 1,
      PaymentMethod: paymentMethod ? paymentMethod : 'Cashfree',
      Remarks: 'Agent subscription activation'
    });

    let wallet = await AgentWallet.findOne({ where: { agentId } });
    if (!wallet) {
      wallet = await AgentWallet.create({
        agentId,
        balance: 100.0, // initial 100 coins balance
        creditLimit: 5000.0,
        outstandingCredit: 0.0,
        escrowBalance: 0.0
      });
    }

    const coinsToAdd = 0.0;
    wallet.balance += coinsToAdd;
    await wallet.save();

    res.status(200).json({
      success: true,
      message: 'Agent subscription activated successfully',
      hostPayment,
      wallet: {
        balance: wallet.balance
      }
    });
  } catch (error) {
    console.error("activateAgentSubscription error:", error);
    res.status(500).json({ message: 'Error activating agent subscription', error: error.message });
  }
};

module.exports = {
  createAgentBooking,
  getAgentPerformance,
  getAgentBookings,
  postAgentDriver,
  getAgentDrivers,
  deleteAgentDriver,
  verifyAgentDriverProfile,
  getAgentWallet,
  depositAgentWallet,
  adjustAgentCreditLimit,
  activateAgentSubscription
};
