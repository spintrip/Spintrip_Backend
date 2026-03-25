const axios = require('axios');
const uuid = require('uuid');
const { User, Vehicle, Chat, Cab, UserAdditional, Listing, sequelize, Booking, Pricing,
  carFeature, Feedback, Host, Tax, Wishlist, Feature, Blog, Bike, Car, HostAdditional, VehicleAdditional, DriverAdditional, BookingExtension, Transaction,
  Driver, CabBookingRequest, Wallet, WalletTransaction } = require('../../Models');
  const { Op } = require('sequelize');
const {
  sendBookingConfirmationEmail,
  sendBookingCompletionEmail,
  sendBookingCancellationEmail,
  generateInvoicePDF,
  sendInvoiceEmail
} = require('../emailController');
const vehicleAdditional = require('../../Models/vehicleAdditional');
const noImgPath = `https://spintrip-s3bucket.s3.ap-south-1.amazonaws.com/vehicleAdditional/no_image.png`;
const checkImage = (value) => {
  return value !== null && value !== undefined && value.length > 0 ? value : noImgPath;
}
const generateOTP = () => {
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  return otp;
};

const sendOTP = async (phone, otp) => {
  console.log(`Sending OTP ${otp} to phone number ${phone}`);
  const url = `https://2factor.in/API/V1/${process.env.SMS_API_KEY}/SMS/${phone}//${otp}/`;
  try {
    const response = await axios.get(url);
    console.log('OTP sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending OTP:', error);
  }
};

const getAllowedHostIds = async (hostId) => {
  if (!hostId) {
    throw new Error("hostId is required");
  }
  const host = await Host.findOne({ where: { id: hostId } });

  let hostIds = [hostId];

  if (host && host.parentHostId === null) {
    const vendors = await Host.findAll({
      where: { parentHostId: hostId }
    });

    vendors.forEach(v => hostIds.push(v.id));
  }

  return hostIds;
};

const getBookingDetails = async (bookingId) => {
  try {
    const booking = await Booking.findOne({
      where: { Bookingid: bookingId }
    });

    if (!booking) {
      const cabBooking = await CabBookingRequest.findOne({ where: { bookingId: bookingId } });
      if (!cabBooking) throw new Error('Booking not found');
      
      const user = await UserAdditional.findOne({ where: { id: cabBooking.userId } });
      const host = await Vehicle.findOne({ where: { vehicleid: cabBooking.vehicleId } });
      const userEmail = user?.Email || 'user@spintrip.in';
      
      let hostEmail = 'host@spintrip.in';
      if (host && host.hostId) {
        const hostInfo = await HostAdditional.findOne({ where: { id: host.hostId } });
        hostEmail = hostInfo?.Email || hostEmail;
      }
      
      const bookingDetails = {
        carModel: cabBooking.cabType || 'Spintrip Cab',
        startDate: cabBooking.date || new Date().toISOString().split('T')[0],
        startTime: cabBooking.time || '',
        endDate: new Date().toISOString().split('T')[0],
        endTime: new Date().toLocaleTimeString(),
        bookingId: bookingId
      };
      
      return { userEmail, hostEmail, bookingDetails };
    }

    const user = await UserAdditional.findOne({
      where: { id: booking.id }
    });
    const host = await Vehicle.findOne({
      where: { vehicleid: booking.vehicleid }
    })

    const userEmail = user?.Email;
    const hostId = host?.hostId;
    var hostEmail = await HostAdditional.findOne({
      where: { id: hostId }
    });
    const bookingDetails = {
      carModel: host?.carmodel || 'Vehicle',
      startDate: booking.startTripDate,
      startTime: booking.startTripTime,
      endDate: booking.endTripDate,
      endTime: booking.endTripTime,
      bookingId: bookingId
    };
    hostEmail = hostEmail?.Email || '';
    return { userEmail, hostEmail, bookingDetails };
  } catch (error) {
    console.error('Error in getBookingDetails:', error);
    throw error;
  }
};

const tripstart = async (req, res) => {
  try {
    const { bookingId, UserOtp } = req.body;
    
    // First, check CabBookingRequest
    const cabBooking = await CabBookingRequest.findOne({ where: { bookingId: bookingId } });
    if (cabBooking) {
      if (cabBooking.status !== 'accepted' && cabBooking.status !== 'assigned') {
         return res.status(404).json({ message: 'Trip already started or cancelled' });
      }
      const userObj = await User.findOne({ where: { id: cabBooking.userId } });
      if (!userObj || (userObj.otp != UserOtp && cabBooking.otp != UserOtp)) {
         return res.status(400).json({ message: 'Invalid OTP' });
      }
      const t = await sequelize.transaction();
      try {
        const estimatedPrice = cabBooking.estimatedPrice || cabBooking.subtotalBasePrice || 0;
        let wallet = await Wallet.findOne({ where: { userId: cabBooking.userId }, transaction: t });

        if (!wallet || wallet.balance < estimatedPrice) {
          await t.rollback();
          return res.status(402).json({ message: `Insufficient Spintrip wallet balance. Required: Rs. ${estimatedPrice}` });
        }

        // Debiting User Wallet exactly as requested
        wallet.balance = parseFloat(wallet.balance) - parseFloat(estimatedPrice);
        await wallet.save({ transaction: t });

        await WalletTransaction.create({
          id: uuid.v4(),
          walletId: wallet.id,
          amount: parseFloat(estimatedPrice),
          type: 'DEBIT',
          description: 'Spintrip Cab Prepaid Fare',
          referenceId: bookingId,
        }, { transaction: t });

        cabBooking.status = 'started';
        await cabBooking.save({ transaction: t });
        await t.commit();

        return res.status(201).json({ message: 'Trip has started' });
      } catch (err) {
        await t.rollback();
        throw err;
      }
    }

    // Fetch the booking and ensure it is pending trip start
    const booking = await Booking.findOne({
      where: { Bookingid: bookingId, status: 1 }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Trip already started or not present' });
    }
    const user = await User.findOne({
      where: { id: booking.id }
    });
    console.log(user, UserOtp);
    if (user.otp != UserOtp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    await Booking.update(
      { status: 2 },
      { where: { Bookingid: bookingId } }
    )

    await Listing.update(
      { bookingId: bookingId },
      { where: { vehicleid: booking.vehicleid } }
    );


    res.status(201).json({ message: 'Trip has started' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};


const bookingcompleted = async (req, res) => {
  try {
    const { bookingId, UserOtp } = req.body;

    // First, check CabBookingRequest
    const cabBooking = await CabBookingRequest.findOne({ where: { bookingId: bookingId } });
    if (cabBooking) {
      if (cabBooking.status !== 'started' && cabBooking.status !== 'ongoing') {
         return res.status(404).json({ message: 'Trip not started or already completed' });
      }

      // Process Driver Wallet Payout
      const t = await sequelize.transaction();
      try {
        const amt = cabBooking.estimatedPrice || cabBooking.finalPrice || 0;
        const taxRow = await Tax.findOne({ order: [['createdAt', 'DESC']] });
        const GST_RATE = taxRow ? taxRow.GST : 5.0;
        const COMMISSION_RATE = taxRow ? taxRow.cabCommission : 20.0;
        const TDS_RATE = taxRow ? taxRow.TDS : 5.0;

        const gstOut = amt - (amt * (100 / (100 + GST_RATE)));
        const netBaseAmount = amt - gstOut;
        const commOut = (netBaseAmount * COMMISSION_RATE) / 100;
        const tdsOut = (netBaseAmount * TDS_RATE) / 100;
        const calculatedEarnings = netBaseAmount - commOut - tdsOut;

        const driverEarnings = cabBooking.driverEarnings > 0 ? cabBooking.driverEarnings : calculatedEarnings;
        const finalDriverId = cabBooking.driverid || cabBooking.driverId;
        
        // Save the generated breakdown permanently into the row!
        cabBooking.driverEarnings = driverEarnings;
        cabBooking.gstAmount = gstOut;
        cabBooking.commissionAmount = commOut;
        cabBooking.tdsAmount = tdsOut;

        let wallet = await Wallet.findOne({ where: { userId: finalDriverId }, transaction: t });
        
        // If driver doesn't have a wallet yet, create one natively
        if (!wallet && finalDriverId) {
          wallet = await Wallet.create({
            id: uuid.v4(),
            userId: finalDriverId,
            balance: 0.0,
          }, { transaction: t });
        }

        if (wallet && driverEarnings > 0) {
          // Credit the Driver's Earnings
          wallet.balance = parseFloat(wallet.balance) + parseFloat(driverEarnings);
          await wallet.save({ transaction: t });

          await WalletTransaction.create({
            id: uuid.v4(),
            walletId: wallet.id,
            amount: parseFloat(driverEarnings),
            type: 'CREDIT',
            description: 'Spintrip Cab Driver Payout',
            referenceId: bookingId,
          }, { transaction: t });
        }

        cabBooking.status = 'completed';
        cabBooking.paymentStatus = 'paid';
        await cabBooking.save({ transaction: t });

        await t.commit();
        
        // Dispatch Email and Invoice out of transaction strictly
        try {
          const { userEmail, hostEmail, bookingDetails } = await getBookingDetails(bookingId);
          await sendBookingCompletionEmail(userEmail, hostEmail, bookingDetails, "Booking complete");
          
          const pricing = {
            price: cabBooking.subtotalBasePrice || cabBooking.estimatedPrice,
            Taxamount: cabBooking.gstAmount || 0,
            FinalPrice: cabBooking.estimatedPrice
          };
          const invoicePath = await generateInvoicePDF(userEmail, hostEmail, bookingDetails, pricing);
          await sendInvoiceEmail(userEmail, invoicePath, bookingDetails);
        } catch (emailErr) {
          console.error("Failed to generate or send cab invoice: ", emailErr);
        }

        return res.status(201).json({ message: 'Booking is now Complete and Payout Credited', redirectTo: '/rating', bookingId });
      } catch (err) {
        await t.rollback();
        throw err;
      }
    }

    // if (payment.status === 'captured') {
    const booking = await Booking.findOne({
      where: {
        Bookingid: bookingId,
        status: 2,
        //id: userId,
      }
    });

    if (booking) {
      // OTP Verification
      if (!UserOtp) {
        return res.status(400).json({ message: 'User OTP is required to complete the booking' });
      }

      const user = await User.findOne({
        where: { id: booking.id }
      });
      
      if (!user || user.otp != UserOtp) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }
      const vehicle = await Vehicle.findOne({
        where: {
          vehicleid: booking.vehicleid,
        }
      });
      await Listing.update(
        { bookingId: null },
        { where: { vehicleid: vehicle.vehicleid } }
      );
      await Booking.update(
        { status: 3 },
        { where: { Bookingid: bookingId } }
      );
      const { userEmail, hostEmail, bookingDetails } = await getBookingDetails(booking.Bookingid);
      await sendBookingCompletionEmail(userEmail, hostEmail, bookingDetails, "Booking complete");

      // ====== Generate & Send Invoice ======
      try {
        const pricing = await Pricing.findOne({ where: { vehicleid: booking.vehicleid } });
        if (pricing) {
            bookingDetails.bookingId = bookingId; // Ensure invoice template has the ID
            const invoicePath = await generateInvoicePDF(userEmail, hostEmail, bookingDetails, pricing);
            await sendInvoiceEmail(userEmail, invoicePath, bookingDetails);
        }
      } catch (invoiceErr) {
        console.error("Failed to generate or send invoice: ", invoiceErr);
        // We do not return 500 here because the trip itself successfully ended
      }

      return res.status(201).json({ message: 'booking complete', redirectTo: '/rating', bookingId });
    }
    else {
      return res.status(404).json({ message: 'Start the ride to Complete Booking' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
}

const cancelbooking = async (req, res) => {
  try {
    const { bookingId, CancelReason } = req.body;
    const booking = await Booking.findOne(
      { where: { Bookingid: bookingId } }
    );
    if (booking) {
      if (booking.status === 1) {
        const today = new Date();
        const cancelDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        await Booking.update(
          {
            status: 4,
            cancelDate: cancelDate,
            cancelReason: CancelReason
          },
          { where: { Bookingid: bookingId } }
        );
        const { userEmail, hostEmail, bookingDetails } = await getBookingDetails(booking.Bookingid);
        // sendBookingCancellationEmail(userEmail, hostEmail, bookingDetails, 'The booking has been cancelled by user')
        res.status(201).json({ message: 'Trip Has been Cancelled' });
      }
      else {
        res.status(404).json({ message: 'Ride Already Started' });
      }
    }
    else {
      res.status(404).json({ message: 'Booking Not found' });
    }
  }
  catch (err) {
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
}
function checkTime(value) {
  if (!value) return "00:00:00";

  const str = value.toString().trim();

  if (
    str === "" ||
    str.toLowerCase() === "not provided" ||
    str.toLowerCase() === "null"
  ) {
    return "00:00:00";
  }

  return str;
}


const hostBookings = async (req, res) => {
  try {
    const hostid = req.user.id;
    const host = await Host.findOne({ where: { id: hostid } });
    if (!host) {
        const driver = await Driver.findOne({ where: { id: hostid } });
        if (driver) {
           return await DriverBookings(req, res);
        }
    }
    const hostIds = await getAllowedHostIds(hostid);
    let bookings = await Booking.findAll({
      include: [
        {
          model: Vehicle,
          where: {   hostId: {
          [Op.in]: hostIds
        } },
          attributes: ['chassisno', 'Rcnumber', 'Enginenumber'],
        },
        {
          model: UserAdditional,
          attributes: ['FullName'] // Assuming 'FullName' is the column name in 'UserAdditional'
        }
      ],
    });
    if (bookings) {
      const featureList = await Feature.findAll();
      const featureMap = featureList.reduce((map, feature) => {
        map[feature.id] = feature.featureName;
        return map;
      }, {});
      const hostBooking = bookings.map(async (booking) => {
        const vehicle = await Vehicle.findOne({
          where: {
            vehicleid: booking.vehicleid,
          }
        });
        if (!vehicle) {
          return;
        }
        const vehicleAdditional = await VehicleAdditional.findOne({
          where: {
            vehicleid: booking.vehicleid,
          }
        });
        if (!vehicleAdditional) {
          return;
        }
        let vehicleModel;
        if (vehicle.vehicletype == 2) {
          const car = await Car.findOne({ where: { vehicleid: vehicle.vehicleid } });
          if (car.brand) {
            vehicleModel = car.brand.charAt(0).toUpperCase() + car.brand.slice(1).toLowerCase();
          }
        }
        if (vehicle.vehicletype == 1) {
          const bike = await Bike.findOne({ where: { vehicleid: vehicle.vehicleid } });
          if (bike.brand) {
            vehicleModel = bike.brand.charAt(0).toUpperCase() + bike.brand.slice(1).toLowerCase();
          }
        }
        if (vehicle.vehicletype == 3) {
          const cab = await Cab.findOne({ where: { vehicleid: vehicle.vehicleid } });
          if (cab.brand) {
            vehicleModel = cab.brand.charAt(0).toUpperCase() + cab.brand.slice(1).toLowerCase();
          }
        }
        const featureDetails = (booking.features || []).map(featureId => ({
          featureId,
          featureName: featureMap[featureId] || 'Unknown Feature'
        }));
        let pickup = null;
        let destination = null;
        let driver = null;
        if (vehicle.vehicletype == 3) {
          pickup = booking.pickup ? booking.pickup : null;
          destination = booking.destination ? booking.destination : null;

          if (booking.driverid) {
            const driverData = await Driver.findOne({ where: { id: booking.driverid } });
            const driverAdditional = await DriverAdditional.findOne({ where: { id: booking.driverid } });
            const driverUser = await User.findOne({ where: { id: booking.driverid } });

            if (driverData) {
              driver = {
                id: driverData.id,
                name: driverAdditional?.FullName || driverData.name || null,
                phone: driverUser?.phone || null
              };
            }
          }
        }
        let bk = {
          bookingId: booking.Bookingid,
          vehicleid: booking.vehicleid,
          id: booking.id,
          bookedBy: booking.UserAdditional ? booking.UserAdditional.FullName : "Not Provided",
          status: booking.status,
          vehicleModel: vehicleModel,
          amount: booking.amount,
          startTripDate: booking.startTripDate,
          endTripDate: booking.endTripDate,
          startTripTime: booking.startTripTime,
          endTripTime: checkTime(booking.endTripTime),
          driverid: booking.driverid,
          vehicletype: vehicle.vehicletype,
          cancelDate: booking.cancelDate || "Not Provided",
          cancelReason: booking.cancelReason || "Not Provided",
          features: featureDetails,
          createdAt: booking.createdAt,
          vehicleImage1: checkImage(vehicleAdditional.vehicleimage1),
          pickup: pickup,
          destination: destination,
          driver: driver

        }
        return { ...bk };
      });
      const hostBookings = await Promise.all(hostBooking);
      res.status(201).json({ hostBookings: hostBookings });
    }
    else {
      res.status(400).json({ message: 'No bookings found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};


const DriverBookings = async (req, res) => {
  try {
    const driverid = req.user.id;
    const driver = await Driver.findOne({ where: { id: driverid } });
    if (!driver) {
      return res.status(403).json({ message: "Not a valid driver" });
    }
    
    // Self-Drive Legacy Bookings
    let bookings = await Booking.findAll({
      where: { driverid: driverid }
    });
    
    // Cab Bookings
    const cabBookings = await CabBookingRequest.findAll({ where: { driverid: driverid } });

    // Formatting Self-Drive Bookings
    const featureList = await Feature.findAll();
    const featureMap = featureList.reduce((map, feature) => {
      map[feature.id] = feature.featureName;
      return map;
    }, {});

    const hostBooking = bookings.map(async (booking) => {
      const vehicle = await Vehicle.findOne({ where: { vehicleid: booking.vehicleid } });
      if (!vehicle) return null;
      
      const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: booking.vehicleid } });
      if (!vehicleAdditional) return null;
      
      let vehicleModel = "Unknown";
      if (vehicle.vehicletype == 2) {
        const car = await Car.findOne({ where: { vehicleid: vehicle.vehicleid } });
        if (car && car.brand) vehicleModel = car.brand.charAt(0).toUpperCase() + car.brand.slice(1).toLowerCase();
      } else if (vehicle.vehicletype == 1) {
        const bike = await Bike.findOne({ where: { vehicleid: vehicle.vehicleid } });
        if (bike && bike.brand) vehicleModel = bike.brand.charAt(0).toUpperCase() + bike.brand.slice(1).toLowerCase();
      } else if (vehicle.vehicletype == 3) {
        const cab = await Cab.findOne({ where: { vehicleid: vehicle.vehicleid } });
        if (cab && cab.brand) vehicleModel = cab.brand.charAt(0).toUpperCase() + cab.brand.slice(1).toLowerCase();
      }

      const featureDetails = (booking.features || []).map(featureId => ({
        featureId,
        featureName: featureMap[featureId] || 'Unknown Feature'
      }));
      
      let pickup = null;
      let destination = null;
      let bkDriver = null;
      if (vehicle.vehicletype == 3) {
        pickup = booking.pickup ? booking.pickup : null;
        destination = booking.destination ? booking.destination : null;
      }
      
      let bookedBy = "Not Provided";
      const bookerUserAdd = await UserAdditional.findOne({ where: { id: booking.id } }); // booking.id is userId
      if (bookerUserAdd) bookedBy = bookerUserAdd.FullName || bookedBy;

      return {
        bookingId: booking.Bookingid,
        vehicleid: booking.vehicleid,
        id: booking.id,
        bookedBy: bookedBy,
        status: booking.status,
        vehicleModel: vehicleModel,
        amount: booking.amount,
        startTripDate: booking.startTripDate,
        endTripDate: booking.endTripDate,
        startTripTime: booking.startTripTime,
        endTripTime: booking.endTripTime || "00:00:00",
        cancelDate: booking.cancelDate || "Not Provided",
        cancelReason: booking.cancelReason || "Not Provided",
        features: featureDetails,
        createdAt: booking.createdAt,
        vehicleImage1: checkImage(vehicleAdditional.vehicleimage1),
        vehicletype: vehicle.vehicletype,
        pickup: pickup,
        destination: destination,
        driver: null // The app requesting this IS the driver!
      };
    });

    // Formatting Cab Bookings
    const taxRow = await Tax.findOne({ order: [['createdAt', 'DESC']] });
    const GST_RATE = taxRow ? taxRow.GST : 5.0;
    const COMMISSION_RATE = taxRow ? taxRow.cabCommission : 20.0;
    const TDS_RATE = taxRow ? taxRow.TDS : 5.0;

    const cabBookingPromises = cabBookings.map(async (cab) => {
      const vehicle = cab.vehicleId ? await Vehicle.findOne({ where: { vehicleid: cab.vehicleId } }) : null;
      let vehicleModel = cab.cabType || "Mini Cab";
      let vehicleImage1 = noImgPath;
      if (vehicle) {
        const cabData = await Cab.findOne({ where: { vehicleid: vehicle.vehicleid } });
        const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: vehicle.vehicleid } });
        if (cabData && cabData.brand) vehicleModel = cabData.brand.charAt(0).toUpperCase() + cabData.brand.slice(1).toLowerCase();
        if (vehicleAdditional && vehicleAdditional.vehicleImage1) vehicleImage1 = vehicleAdditional.vehicleImage1;
      }

      let bookedBy = "Not Provided";
      const bookerUserAdd = await UserAdditional.findOne({ where: { id: cab.userId } });
      const bookerUser = await User.findOne({ where: { id: cab.userId } });
      if (bookerUserAdd) bookedBy = bookerUserAdd.FullName || bookedBy;

      let intStatus = 5; // Default Booking Confirmed
      if (cab.status === 'accepted' || cab.status === 'assigned') intStatus = 1;
      if (cab.status === 'started' || cab.status === 'ongoing') intStatus = 2;
      if (cab.status === 'completed') intStatus = 3;
      if (cab.status === 'cancelled' || cab.paymentStatus === 'failed') intStatus = 4;

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

      const amt = cab.estimatedPrice || cab.finalPrice || 0;
      const gstOut = amt - (amt * (100 / (100 + GST_RATE)));
      const netBaseAmount = amt - gstOut;
      const commOut = (netBaseAmount * COMMISSION_RATE) / 100;
      const tdsOut = (netBaseAmount * TDS_RATE) / 100;
      const dEarn = netBaseAmount - commOut - tdsOut;

      return {
        bookingId: cab.bookingId,
        vehicleid: cab.vehicleId || "",
        id: cab.userId,
        bookedBy: bookedBy,
        userPhone: bookerUser ? bookerUser.phone : null,
        status: intStatus,
        vehicleModel: vehicleModel,
        amount: amt,
        gstAmount: gstOut,
        commissionAmount: commOut,
        tdsAmount: tdsOut,
        driverEarnings: dEarn,
        startTripDate: (cab.date || cab.createdAt.toISOString().split('T')[0]),
        endTripDate: (cab.date || cab.createdAt.toISOString().split('T')[0]),
        startTripTime: (cab.time || cab.createdAt.toISOString().split('T')[1].slice(0, 5)),
        endTripTime: "00:00:00",
        cancelDate: "Not Provided",
        cancelReason: "Not Provided",
        features: [],
        createdAt: (cab.createdAt),
        vehicleImage1: vehicleImage1,
        vehicletype: 3,
        pickup: pickupObj,
        destination: destObj,
        driver: null
      };
    });

    const legacyHostBookings = (await Promise.all(hostBooking)).filter(b => b !== null);
    const newCabBookings = (await Promise.all(cabBookingPromises)).filter(b => b !== null);

    const allBookings = [...legacyHostBookings, ...newCabBookings];
    // Sort array descending by creation date
    allBookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(201).json({ hostBookings: allBookings });
  } catch (error) {
    console.error("Error DriverBookings: ", error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

const postHostRating = async (req, res) => {
  try {
    let { bookingId, rating } = req.body;
    if (!rating) {
      rating = 5;
    }
    const userId = req.user.id;
    const booking = await Booking.findOne({
      where: {
        Bookingid: bookingId,
        //id: userId,
      }
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    const user = await User.findOne({
      where: {
        id: booking.id,
      }
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const bookingCount = await Booking.count({
      where: {
        id: booking.id,
        status: 3,
      }
    });
    let new_rating;
    if (bookingCount == 1) {
      new_rating = parseFloat(rating);
    }
    else {
      new_rating = (parseFloat(rating) + parseFloat(user.rating * (bookingCount - 1))) / (bookingCount);
    }
    user.update({ rating: new_rating });
    res.status(201).json('Thank you for your response');
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

module.exports = { generateOTP, sendOTP, tripstart, bookingcompleted, cancelbooking, hostBookings, postHostRating, DriverBookings };