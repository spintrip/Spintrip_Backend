const { Booking, CabBookingRequest, CabBookingAccepted, Driver, Vehicle, User, UserAdditional } = require('../../Models');
const { sendPushNotification } = require('../../Utils/notifications');

// Get all bookings
const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.findAll();
        // Replace line 8 with:
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
        amount: cab.estimatedPrice || cab.subtotalBasePrice || 0,
        GSTAmount: cab.gstAmount || 0,
        totalUserAmount: cab.finalPrice || cab.estimatedPrice || 0,
        TDSAmount: cab.tdsAmount || 0,
        totalHostAmount: cab.driverEarnings || 0,
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
      if(cabBooking) {
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

         // --- SEND NOTIFICATIONS ---
         if (updatedFields.driverid || updatedFields.vehicleid || updatedFields.status === 1) {
           try {
             const customer = await User.findByPk(cabBooking.userId);
             const driver = updatedFields.driverid ? await User.findByPk(updatedFields.driverid) : null;

             // Notify Customer
             if (customer && customer.fcmToken) {
               await sendPushNotification(
                 customer.fcmToken,
                 "Driver Assigned",
                 `Your cab for Booking ${cabBooking.bookingId} has been assigned.`,
                 { bookingId: cabBooking.bookingId, type: 'assignment' }
               );
             }

             // Notify Driver
             if (driver && driver.fcmToken) {
               await sendPushNotification(
                 driver.fcmToken,
                 "New Booking Assigned",
                 `A new booking (${cabBooking.bookingId}) has been assigned to you.`,
                 { bookingId: cabBooking.bookingId, type: 'assignment' }
               );
             }
           } catch (notiError) {
             console.error("Notification Error:", notiError.message);
             // We don't fail the request if notification fails
           }
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

    await booking.update({ status: 'cancelled' });

    res.status(200).json({ message: 'Cab Booking Cancelled successfully', booking });
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
  cancelCabBooking, sendCabInvoice
};
