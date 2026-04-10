const { Booking, CabBookingRequest, Cab, CabBookingAccepted, Driver, Vehicle, User, UserAdditional, sequelize } = require('../../Models');
const { notifyBookingAllocation } = require('../../Utils/notificationService');
const { refundBookingCoins } = require('../cabController');

const createAdminBooking = async (req, res) => {
  const {
    customerPhone,
    customerName,
    cabType,
    bookingType,
    date,
    time,
    startLocation, // Changed from pickupLocation
    endLocation,   // Changed from dropLocation
    amount
  } = req.body;

  const t = await sequelize.transaction();

  try {
    let user = await User.findOne({ where: { phone: customerPhone }, transaction: t });
    let userId;

    if (!user) {
      userId = require('uuid').v4();
      user = await User.create({ id: userId, phone: customerPhone, role: 'user', password: '123' }, { transaction: t });
      await UserAdditional.create({ id: userId, FullName: customerName || 'Admin Created User' }, { transaction: t });
    } else {
      userId = user.id;
    }

    const { Tax } = require('../../Models');
    const taxRow = await Tax.findOne({ order: [['createdAt', 'DESC']] });
    const COMMISSION_RATE = taxRow ? (taxRow.Commission || 20.0) : 20.0;

    const estimatedPrice = parseFloat(amount) || 0;
    const netBase = estimatedPrice / 1.05;
    const commissionAmount = netBase * (COMMISSION_RATE / 100);
    const tdsAmount = netBase * 0.01; // 1% of Gross (excluding GST)
    const payToDriverAmount = Math.round((netBase - commissionAmount - tdsAmount) * 100) / 100;
    const confirmationFeeAmount = Math.round((estimatedPrice - payToDriverAmount) * 100) / 100;

    const bookingId = `CB-${Date.now()}`;
    const rideOtp = Math.floor(1000 + Math.random() * 9000);
    const getAddr = (loc) => (loc && typeof loc === 'object' ? loc.address : loc) || "";
    const getLat = (loc) => (loc && typeof loc === 'object' ? loc.latitude : null);
    const getLng = (loc) => (loc && typeof loc === 'object' ? loc.longitude : null);

    // This now matches your mobile app's schema exactly
    const booking = await CabBookingRequest.create({
      bookingId,
      userId,
      date: date || null,
      time: time || null,
      startLocationAddress: getAddr(startLocation),
      startLocationLatitude: getLat(startLocation),
      startLocationLongitude: getLng(startLocation),
      endLocationAddress: getAddr(endLocation),
      endLocationLatitude: getLat(endLocation),
      endLocationLongitude: getLng(endLocation),
      estimatedPrice: estimatedPrice,
      status: "pending",
      paymentStatus: "pending",
      cabType: cabType || 'mini eco',
      confirmationFee: confirmationFeeAmount,
      payToDriver: payToDriverAmount,
      rideOtp: rideOtp,
      bookingType: bookingType || "Local"
    }, { transaction: t });

    await t.commit();
    res.status(201).json({ message: "Booking created successfully", bookingId, booking });
  } catch (error) {
    if (t) await t.rollback();
    console.error("Admin Booking Error:", error);
    res.status(500).json({ message: "Error creating booking", error: error.message });
  }
};


// Get all bookings
const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.findAll();
    // Fetch both Rentals and Cab Bookings
    const cabBookingsRaw = await CabBookingRequest.findAll({
      include: [
        {
          model: User,
          as: 'Customer',
          attributes: ['phone'],
          include: [{
            model: UserAdditional,
            attributes: ['FullName']
          }]
        }
      ]
    });


    const mappedCabBookings = cabBookingsRaw.map(cab => {
      let statusInt = 5;
      if (cab.status === 'pending') statusInt = 5;
      else if (cab.status === 'accepted') statusInt = 1;
      else if (cab.status === 'started') statusInt = 2;
      else if (cab.status === 'completed') statusInt = 3;
      else if (cab.status === 'cancelled') statusInt = 4;

      return {
        Bookingid: cab.bookingId,
        id: cab.userId,
        customerName: cab.Customer?.UserAdditional?.FullName || 'N/A', // New field
        customerPhone: cab.Customer?.phone || 'N/A',
        vehicleid: cab.vehicleId,
        driverid: cab.driverid,
        date: cab.date,
        time: cab.time,
        status: statusInt,
        amount: cab.estimatedPrice || 0,
        GSTAmount: cab.gstAmount || Math.round((cab.estimatedPrice - (cab.estimatedPrice / 1.05)) * 100) / 100,
        totalUserAmount: cab.estimatedPrice || 0,
        TDSAmount: cab.tdsAmount || Math.round(((cab.estimatedPrice / 1.05) * 0.01) * 100) / 100,
        totalHostAmount: cab.payToDriver || 0,
        confirmationFee: cab.confirmationFee || 0,
        payToDriver: cab.payToDriver || 0,
        startTripDate: cab.date || (cab.createdAt ? new Date(cab.createdAt).toISOString().split('T')[0] : ''),
        startTripTime: cab.startTripTime,
        endTripTime: cab.endTripTime,
        pickUpLocation: cab.startLocationAddress || '',
        dropOffLocation: cab.endLocationAddress || '',
        pickUpLat: cab.startLocationLatitude || null,
        pickUpLng: cab.startLocationLongitude || null,
        distance: '',
        carname: cab.cabType || '',
        pointAToBDate: cab.date || (cab.createdAt ? new Date(cab.createdAt).toISOString().split('T')[0] : ''),
        pointAToBTime: cab.time || (cab.createdAt ? new Date(cab.createdAt).toISOString().split('T')[1].slice(0, 5) : ''),
        paymentMethod: cab.paymentStatus || '',
        createdAt: cab.createdAt,
        updatedAt: cab.updatedAt,
        type: 'cab',
        isCab: true
      };
    });

    const unifiedBookings = [...bookings, ...mappedCabBookings];

    res.status(200).json({ message: "All available bookings", bookings: unifiedBookings });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching bookings', error });
  }
};

// Get a booking by ID
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    let booking = null;
    let cabBooking = null;

    if (isNaN(id) || String(id).startsWith('CB-')) {
      cabBooking = await CabBookingRequest.findOne({ where: { bookingId: id } });
    } else {
      booking = await Booking.findByPk(id);
      if (!booking) {
        cabBooking = await CabBookingRequest.findByPk(id);
      }
    }

    if (!booking) {
      if (cabBooking) {
        let statusInt = 5;
        if (cabBooking.status === 'pending') statusInt = 5;
        else if (cabBooking.status === 'accepted') statusInt = 1;
        else if (cabBooking.status === 'started') statusInt = 2;
        else if (cabBooking.status === 'completed') statusInt = 3;
        else if (cabBooking.status === 'cancelled') statusInt = 4;

        booking = {
          Bookingid: cabBooking.bookingId,
          id: cabBooking.userId,
          vehicleid: cabBooking.vehicleId,
          driverid: cabBooking.driverid,
          date: cabBooking.date,
          time: cabBooking.time,
          status: statusInt,
          amount: cabBooking.estimatedPrice || cabBooking.subtotalBasePrice || 0,
          GSTAmount: cabBooking.gstAmount || 0,
          totalUserAmount: cabBooking.finalPrice || cabBooking.estimatedPrice || 0,
          TDSAmount: cabBooking.tdsAmount || 0,
          totalHostAmount: cabBooking.driverEarnings || 0,
          startTripDate: cabBooking.date || (cabBooking.createdAt ? new Date(cabBooking.createdAt).toISOString().split('T')[0] : ''),
          startTripTime: cabBooking.startTripTime,
          endTripTime: cabBooking.endTripTime,
          pickUpLocation: cabBooking.startLocationAddress || '',
          dropOffLocation: cabBooking.endLocationAddress || '',
          pickUpLat: cabBooking.startLocationLatitude || null,
          pickUpLng: cabBooking.startLocationLongitude || null,
          distance: '',
          carname: cabBooking.cabType || '',
          pointAToBDate: cabBooking.date || (cabBooking.createdAt ? new Date(cabBooking.createdAt).toISOString().split('T')[0] : ''),
          pointAToBTime: cabBooking.time || (cabBooking.createdAt ? new Date(cabBooking.createdAt).toISOString().split('T')[1].slice(0, 5) : ''),
          paymentMethod: cabBooking.paymentStatus || '',
          createdAt: cabBooking.createdAt,
          updatedAt: cabBooking.updatedAt,
          isCab: true
        };
      }
    }

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.status(200).json({ booking });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching booking', error });
  }
};

// Update a booking by ID
const updateBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedFields = req.body;

    let booking = null;
    let cabBooking = null;

    if (isNaN(id) || String(id).startsWith('CB-')) {
      cabBooking = await CabBookingRequest.findOne({ where: { bookingId: id } });
    } else {
      booking = await Booking.findByPk(id);
      if (!booking) {
        cabBooking = await CabBookingRequest.findByPk(id);
      }
    }

    if (!booking) {
      if (cabBooking) {
        const cabUpdates = {};
        if (updatedFields.status !== undefined) {
          let enumStatus = 'pending';
          if (updatedFields.status === 5) enumStatus = 'pending';
          if (updatedFields.status === 1) enumStatus = 'accepted';
          if (updatedFields.status === 2) enumStatus = 'started';
          if (updatedFields.status === 3) enumStatus = 'completed';
          if (updatedFields.status === 4) enumStatus = 'cancelled';
          cabUpdates.status = enumStatus;
        }
        if (updatedFields.vehicleid !== undefined) cabUpdates.vehicleId = updatedFields.vehicleid;
        if (updatedFields.driverid !== undefined) cabUpdates.driverid = updatedFields.driverid;
        if (updatedFields.amount !== undefined) cabUpdates.estimatedPrice = updatedFields.amount;
        if (updatedFields.GSTAmount !== undefined) cabUpdates.gstAmount = updatedFields.GSTAmount;
        if (updatedFields.totalUserAmount !== undefined) cabUpdates.finalPrice = updatedFields.totalUserAmount;
        if (updatedFields.TDSAmount !== undefined) cabUpdates.tdsAmount = updatedFields.TDSAmount;
        if (updatedFields.totalHostAmount !== undefined) cabUpdates.driverEarnings = updatedFields.totalHostAmount;

        await cabBooking.update(cabUpdates);

        // --- SEND NOTIFICATIONS (GENERIC HELPER) ---
        if (updatedFields.driverid || updatedFields.vehicleid || updatedFields.status === 1) {
          await notifyBookingAllocation(
            cabBooking.bookingId,
            updatedFields.driverid || cabBooking.driverid,
            cabBooking.userId
          );
        }

        return res.status(200).json({ message: 'Cab Booking updated successfully', booking: cabBooking });
      }
      return res.status(404).json({ message: 'Booking not found' });
    }

    await booking.update(updatedFields);
    res.status(200).json({ message: 'Booking updated successfully', booking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating booking', error });
  }
};

// Delete a booking by ID
const deleteBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findByPk(id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    await booking.destroy();
    res.status(200).json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting booking', error });
  }
};


// Admin cancels a booking
const cancelCabBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await CabBookingRequest.findByPk(id);
    if (!booking) {
      return res.status(404).json({ message: 'Cab Booking Request not found' });
    }

    const t = await sequelize.transaction();
    try {
      await booking.update({ status: 'cancelled' }, { transaction: t });

      // --- 🪙 REFUND COINS ---
      await refundBookingCoins(id, t);

      await t.commit();
      res.status(200).json({ message: 'Cab Booking Cancelled successfully and coins refunded (if any)', booking });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error cancelling booking', error: error.message });
  }
};

// Admin sends an invoice
const sendCabInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const cabBooking = await CabBookingRequest.findByPk(id);
    if (!cabBooking) {
      return res.status(404).json({ message: 'Cab Booking Request not found' });
    }

    const { generateInvoicePDF, sendInvoiceEmail } = require('../emailController');
    const user = await User.findByPk(cabBooking.userId);

    const bookingDetails = {
      bookingId: cabBooking.bookingId,
      carModel: cabBooking.cabType || 'Cab',
      startDate: cabBooking.date,
      startTime: cabBooking.time,
      endDate: cabBooking.date,
      endTime: cabBooking.endTripTime
    };

    const pricingDetails = {
      price: cabBooking.subtotalBasePrice,
      Taxamount: cabBooking.gstAmount,
      FinalPrice: cabBooking.finalPrice,
      tdsAmount: cabBooking.tdsAmount
    };

    const invoiceData = await generateInvoicePDF(user.email, 'info@spintrip.in', bookingDetails, pricingDetails);
    await sendInvoiceEmail(user.email, invoiceData, bookingDetails);

    res.status(200).json({
      success: true,
      message: 'Official invoice generated and sent to customer.',
      s3Url: invoiceData.s3Url
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error sending invoice', error: error.message });
  }
};

module.exports = {
  getAllBookings, getBookingById, updateBookingById, deleteBookingById,
  cancelCabBooking, sendCabInvoice, createAdminBooking
};
