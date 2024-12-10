const axios = require('axios');
const { User, Vehicle, Chat, UserAdditional, Listing, sequelize, Booking, Pricing,
  carFeature, Feedback, Host, Tax, Wishlist, Feature, Blog, Bike, Car, HostAdditional, VehicleAdditional, BookingExtension, Transaction } = require('../../Models');
  const {
    sendBookingConfirmationEmail,
    sendBookingCompletionEmail,
    sendBookingCancellationEmail
  } = require('../emailController');
const vehicleAdditional = require('../../Models/vehicleAdditional');
const noImgPath = `https://spintrip-bucket.s3.ap-south-1.amazonaws.com/vehicleAdditional/no_image.webp`;
const checkImage = (value) => {
  return value !== null && value !==undefined && value.length > 0 ? value : noImgPath;
}
  const generateOTP = () => {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    return otp;
  };

  const sendOTP = async(phone, otp) => {
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

  const getBookingDetails = async (bookingId) => {
    try {
      const booking = await Booking.findOne({
        where: { Bookingid: bookingId }
      });
  
      if (!booking) {
        throw new Error('Booking not found');
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
        carModel: host.carmodel,
        startDate: booking.startTripDate,
        startTime: booking.startTripTime,
        endDate: booking.endTripDate,
        endTime: booking.endTripTime,
      };
      hostEmail = hostEmail.Email;
      return { userEmail, hostEmail, bookingDetails };
    } catch (error) {
      console.error('Error in getBookingDetails:', error);
      throw error;
    }
  };

  const tripstart = async (req, res) => {
    try {
      const { bookingId } = req.body;
      // Fetch the booking and ensure it is pending trip start
      const booking = await Booking.findOne({
        where: { Bookingid: bookingId, status: 1 }
      });
  
      if (!booking) {
        return res.status(404).json({ message: 'Trip already started or not present' });
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
      res.status(500).json({ message: 'Server error' });
    }
  };

  const bookingcompleted = async (req, res) => {
    try {
      const { bookingId } = req.body;
      // if (payment.status === 'captured') {
      const booking = await Booking.findOne({
        where: {
          Bookingid: bookingId,
          status: 2,
          //id: userId,
        }
      });
      if (booking) {
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
        const { userEmail, hostEmail, bookingDetails } = await getBookingDetails(bookingId);
        await sendBookingCompletionEmail(userEmail, hostEmail, bookingDetails, "Booking complete");
        return res.status(201).json({ message: 'booking complete', redirectTo: '/rating', bookingId });
      }
      else {
        return res.status(404).json({ message: 'Start the ride to Complete Booking' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
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
          sendBookingCancellationEmail(userEmail, hostEmail, bookingDetails, 'The booking has been cancelled by user')
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
      res.status(500).json({ message: 'Server error' });
    }
  }


  const hostBookings = async(req , res) => {
    try {
      const hostid = req.user.id;
      let bookings = await Booking.findAll({
        include: [
          {
            model: Vehicle,
            where: { hostId: hostid },
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
          if(vehicle.vehicletype == 2){
             const car = await Car.findOne({ where: { vehicleid: vehicle.vehicleid } });
             vehicleModel = car.carmodel; 
          }
          if(vehicle.vehicletype == 1){
           const bike = await Bike.findOne({ where: { vehicleid: vehicle.vehicleid } });
           vehicleModel = bike.bikemodel; 
          }
          const featureDetails = (booking.features || []).map(featureId => ({
            featureId,
            featureName: featureMap[featureId] || 'Unknown Feature'
          }));
          let bk = {
            bookingId: booking.Bookingid,
            vehicleid: booking.vehicleid,
            id: booking.id,
            bookedBy: booking.UserAdditional ? booking.UserAdditional.FullName : "Not Provided",
            status: booking.status,
            vehicleModel:vehicleModel,
            amount: booking.amount,
            startTripDate: booking.startTripDate,
            endTripDate: booking.endTripDate,
            startTripTime: booking.startTripTime,
            endTripTime: booking.endTripTime,
            cancelDate: booking.cancelDate || "Not Provided",
            cancelReason: booking.cancelReason || "Not Provided",
            features: featureDetails,
            createdAt: booking.createdAt,
            vehicleImage1: checkImage(vehicleAdditional.vehicleimage1),

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
      res.status(500).json({ message: 'Server error' });
    }
  };

 const postHostRating = async(req, res) => {
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
      if( bookingCount == 1 ){
        new_rating = parseFloat(rating);     
      }
      else{
        new_rating = (parseFloat(rating) + parseFloat(user.rating * (bookingCount - 1))) / (bookingCount);
      }
      user.update({ rating: new_rating });
      res.status(201).json('Thank you for your response');
    }
    catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };

  module.exports = { generateOTP, sendOTP, tripstart, bookingcompleted, cancelbooking, hostBookings, postHostRating};