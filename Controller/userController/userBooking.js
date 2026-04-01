const { User, Vehicle, Chat, UserAdditional, Listing, sequelize, Booking, Pricing,
  carFeature, Feedback, Host, Tax, Wishlist, Feature, Blog, Bike, Car, Cab, HostAdditional, VehicleAdditional, DriverAdditional, Driver, BookingExtension, Transaction, CabBookingRequest, CabBookingAccepted } = require('../../Models');
const uuid = require('uuid');
const { Op } = require('sequelize');
const moment = require('moment');

const {
  sendBookingConfirmationEmail,
  sendBookingApprovalEmail,
  sendTripStartEmail,
  sendTripEndEmail,
  sendPaymentConfirmationEmail,
  sendBookingCancellationEmail,
  sendBookingCompletionEmail
} = require('../../Controller/emailController');
const { checkData, checkStatus } = require('./userProfile');
const { refundBookingCoins } = require('../cabController');

const noVehicleImg = `https://spintrip-s3bucket.s3.ap-south-1.amazonaws.com/vehicleAdditional/no_image.png`;

const checkImage = (value) => {
  return value !== null && value !== undefined ? value : noVehicleImg;
}
const validateBookingDates = (startDate, endDate, startTime, endTime) => {
  const startDateTime = moment(`${startDate} ${startTime}`, "YYYY-MM-DD HH:mm");
  const endDateTime = moment(`${endDate} ${endTime}`, "YYYY-MM-DD HH:mm");

  // if (!startDateTime.isValid() || !endDateTime.isValid()) {
  //   return { isValid: false, error: "Invalid date or time format." };
  // }

  // if (!startDateTime.isBefore(endDateTime)) {
  //   return { isValid: false, error: "End time must be after start time." };
  // }

  // if (startDateTime.isBefore(moment())) {
  //   return { isValid: false, error: "Start date and time must be in the future." };
  // }

  return { isValid: true };
};

function calculateTripHours(startTripDate, endTripDate, startTripTime, endTripTime) {
  // Combine date and time into a single string for both start and end
  const startDateTimeStr = `${startTripDate} ${startTripTime}`;
  const endDateTimeStr = `${endTripDate} ${endTripTime}`;

  // Parse the date and time strings into Date objects
  const startDateTime = new Date(startDateTimeStr);
  const endDateTime = new Date(endDateTimeStr);

  // Calculate the difference in milliseconds and then convert to hours
  const diffMilliseconds = endDateTime - startDateTime;
  const diffHours = diffMilliseconds / (1000 * 60 * 60);

  return diffHours;
}
const getBookingDetails = async (bookingId) => {
  try {
    const booking = await Booking.findOne({
      where: { Bookingid: bookingId }
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Fetch the host's user details using the hostId from the car model
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


const booking = async (req, res) => {
  try {
    const { vehicleid, startDate, endDate, startTime, endTime, pickup, destination, features } = req.body;
    const userId = req.user.id;

    console.log('Received booking request with data:', { vehicleid, startDate, endDate, startTime, endTime, pickup, destination, features, userId });

    const t = await sequelize.transaction();

    try {
      // Fetch vehicle
      const vehicle = await Vehicle.findByPk(vehicleid, { transaction: t });
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    const isCab = vehicle.vehicletype == 3; // 🚕 CAB FLAG

    // ==============================
    // DATE VALIDATION
    // ==============================
    if (!isCab) {
      // 🚗 🏍 Only for car/bike
      const dateValidation = validateBookingDates(startDate, endDate, startTime, endTime);
      if (!dateValidation.isValid) {
        return res.status(400).json({ message: dateValidation.error });
      }
    } else {
      // 🚕 CAB: only startDate + startTime required
      if (!startDate || !startTime || !pickup || !destination) {
        return res.status(400).json({ message: 'Cab booking requires pickup, destination, date and time' });
      }
    }

    // ==============================
    // HOST VALIDATION
    // ==============================
    console.log('Fetching host details for vehicle:', vehicle.hostId);
    const host = await Host.findByPk(vehicle.hostId);
    if (!host) {
      return res.status(404).json({ message: 'Host not found' });
    }

    if (host.onlyVerifiedUsers) {
      const userAdditional = await UserAdditional.findOne({ where: { id: userId } });
      if (!userAdditional || userAdditional.verification_status == 1 || userAdditional.verification_status == null) {
        return res.status(403).json({ message: 'Only verified users can book this vehicle' });
      }
    }

    if (!isCab) {
      const listing = await Listing.findOne({
        where: {
          vehicleid: vehicleid,
          [Op.and]: [
            {
              [Op.or]: [
                {
                  [Op.or]: [
                    {
                      pausetime_start_date: {
                        [Op.gt]: endDate,
                      },
                    },
                    {
                      pausetime_end_date: {
                        [Op.lt]: startDate,
                      },
                    },
                  ],
                },
                {
                  [Op.or]: [
                    {
                      [Op.and]: [
                        {
                          [Op.or]: [
                            { pausetime_start_date: endDate },
                            { pausetime_start_date: null },
                          ],
                        },
                        {

                          [Op.or]: [
                            { pausetime_start_time: { [Op.gte]: endTime } },
                            { pausetime_start_time: null },
                          ],
                        },
                      ],
                    },
                    {
                      [Op.and]: [
                        {
                          [Op.or]: [
                            { pausetime_end_date: startDate },
                            { pausetime_end_date: null },
                          ],
                        },
                        {
                          [Op.or]: [
                            { pausetime_end_time: { [Op.lte]: startTime } },
                            { pausetime_end_time: null },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              [Op.or]: [
                {
                  [Op.and]: [
                    {
                      start_date: {
                        [Op.lt]: startDate,
                      },
                    },
                    {
                      end_date: {
                        [Op.gt]: endDate,
                      },
                    },
                  ],
                },
                {
                  [Op.or]: [
                    {
                      [Op.and]: [
                        {
                          [Op.or]: [
                            { start_date: startDate },
                            { start_date: null },
                          ],
                        },
                        {

                          [Op.or]: [
                            { start_time: { [Op.lte]: startTime } },
                            { start_time: null },
                          ],
                        },
                      ],
                    },
                    {
                      [Op.and]: [
                        {
                          [Op.or]: [
                            { end_date: endDate },
                            { end_date: null },
                          ],
                        },
                        {
                          [Op.or]: [
                            { end_time: { [Op.gte]: endTime } },
                            { end_time: null },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        include: [Vehicle],
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!listing) {
        return res.status(400).json({ message: 'Selected vehicle is not available for the specified dates' });
      }
    }
    // 🚕 CAB SKIPS LISTING CHECK COMPLETELY

    // ==============================
    // PRICING
    // ==============================
    let amount = 0;

    if (!isCab) {
      // 🚗 🏍 Rental pricing
      let cph = await Pricing.findOne({ where: { vehicleid: vehicleid } });
      let hours = calculateTripHours(startDate, endDate, startTime, endTime);
      amount = Math.round(cph.costperhr * hours);

      let featureCost = 0;
      if (features) {
        for (const feature of features) {
          const featureDetail = await carFeature.findOne({ where: { featureid: feature, vehicleid: vehicleid } });
          if (featureDetail) featureCost += featureDetail.price;
        }
      }
      amount += featureCost;
    } else {
      amount = req.body.amount || 0;
    }

    let driverId = null;
    if (isCab) {
      const cabData = await Cab.findOne({ where: { vehicleid } });
      driverId = cabData?.driverId || null;
    }

    // ==============================
    // CREATE BOOKING
    // ==============================
    const bookingid = uuid.v4();
    console.log('Creating booking with data:', { bookingid, vehicleid, startDate, endDate, startTime, endTime, userId, amount, features, driverId, pickup, destination });
    let booking = await Booking.create({
      Bookingid: bookingid,
      vehicleid: vehicleid,

      // Rental fields
      startTripDate: startDate,
      endTripDate: isCab ? startDate : endDate,
      startTripTime: startTime,
      endTripTime: isCab ? null : endTime,

      id: userId,
      status: 1,
      amount: amount,
      features: isCab ? null : features,

      // 🚕 CAB FIELDS
      driverid: isCab ? driverId : null,
      pickup: isCab ? pickup : null,
      destination: isCab ? destination : null,
    }, { transaction: t });

    await t.commit();

    const bookings = {
      bookingId: booking.Bookingid,
      vehicleid: booking.vehicleid,
      id: booking.id,
      status: booking.status,
      amount: booking.amount,
      startTripDate: booking.startTripDate,
      endTripDate: booking.endTripDate,
      startTripTime: booking.startTripTime,
      endTripTime: booking.endTripTime,
      pickup: booking.pickup,
      destination: booking.destination,
      driverid: booking.driverid,
    };

    const { userEmail, hostEmail, bookingDetails } = await getBookingDetails(bookings.bookingId);
    // await sendBookingConfirmationEmail(userEmail, hostEmail, bookingDetails, "Booking successful");

    res.status(201).json({ message: 'Booking successful', bookings });

    } catch (innerError) {
      await t.rollback();
      throw innerError;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error processing booking' });
  }
};




const extend = async (req, res) => {
  try {
    const { bookingId, newEndDate, newEndTime } = req.body;
    const userId = req.user.userid;

    // Check if the original booking exists and is active
    const booking = await Booking.findOne({
      where: {
        Bookingid: bookingId,
        id: userId,
        status: 2,
      },
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found or not active' });
    }

    // Validate the new dates
    const currentEndDate = booking.endTripDate;
    const currentEndTime = booking.endTripTime;
    if (newEndDate < currentEndDate || (newEndDate === currentEndDate && newEndTime <= currentEndTime)) {
      return res.status(400).json({ message: 'New end date and time must be after the current end date and time' });
    }

    // Check for overlapping extensions
    const bookingExtension = await BookingExtension.findOne({ where: { bookingId } });
    if (bookingExtension) {
      const overlappingExtension = await Booking.findOne({
        where: {
          Bookingid: { [Op.in]: bookingExtension.extendedBookings },
          [Op.or]: [
            {
              startTripDate: { [Op.lte]: newEndDate },
              endTripDate: { [Op.gte]: booking.startTripDate },
              startTripTime: { [Op.lt]: newEndTime },
              endTripTime: { [Op.gt]: booking.startTripTime },
            },
          ],
        },
      });

      if (overlappingExtension) {
        return res.status(400).json({ message: 'Extension dates overlap with existing extensions' });
      }
    }

    // Check car availability
    const listing = await Listing.findOne({
      where: {
        vehicleid: booking.vehicleid,
        [Op.and]: [
          {
            [Op.or]: [
              {
                [Op.or]: [
                  {
                    pausetime_start_date: {
                      [Op.gt]: newEndDate,
                    },
                  },
                  {
                    pausetime_end_date: {
                      [Op.lt]: booking.startTripDate,
                    },
                  },
                ],
              },
              {
                [Op.or]: [
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { pausetime_start_date: newEndDate },
                          { pausetime_start_date: null },
                        ],
                      },
                      {
                        [Op.or]: [
                          { pausetime_start_time: { [Op.gte]: newEndTime } },
                          { pausetime_start_time: null },
                        ],
                      },
                    ],
                  },
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { pausetime_end_date: booking.startTripDate },
                          { pausetime_end_date: null },
                        ],
                      },
                      {
                        [Op.or]: [
                          { pausetime_end_time: { [Op.lte]: booking.startTripTime } },
                          { pausetime_end_time: null },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            [Op.or]: [
              {
                [Op.and]: [
                  {
                    start_date: {
                      [Op.lt]: booking.startTripDate,
                    },
                  },
                  {
                    end_date: {
                      [Op.gt]: newEndDate,
                    },
                  },
                ],
              },
              {
                [Op.or]: [
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { start_date: booking.startTripDate },
                          { start_date: null },
                        ],
                      },
                      {
                        [Op.or]: [
                          { start_time: { [Op.lte]: booking.startTripTime } },
                          { start_time: null },
                        ],
                      },
                    ],
                  },
                  {
                    [Op.and]: [
                      {
                        [Op.or]: [
                          { end_date: newEndDate },
                          { end_date: null },
                        ],
                      },
                      {
                        [Op.or]: [
                          { end_time: { [Op.gte]: newEndTime } },
                          { end_time: null },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    if (!listing) {
      return res.status(400).json({ message: 'vehicle is not available' });
    }

    // Create the extended booking if all checks pass
    const additionalHours = calculateTripHours(currentEndDate, newEndDate, currentEndTime, newEndTime);
    const cph = await Pricing.findOne({ where: { vehicleid: booking.vehicleid } });
    let additionalAmount = Math.round(cph.costperhr * additionalHours);
    additionalAmount += 20 * (additionalAmount) / 100;
    const tax = await Tax.findOne({ where: { id: 1 } });
    if (!tax) {
      return res.status(404).json({ message: 'Tax data not found' });
    }
    let spinTripGST = additionalAmount * (tax.GST / 100) * (tax.Commission / 100);
    let hostGst = (additionalAmount - (additionalAmount * tax.Commission / 100)) * (tax.HostGST / 100);
    let gstAmount = spinTripGST + hostGst;
    let insuranceAmount = (additionalAmount * tax.insurance) / 100;
    const tdsRate = tax.TDS / 100;
    const hostCommission = 1 - (tax.Commission / 100);
    let tds = ((additionalAmount * hostCommission) * tdsRate).toFixed(2);
    let totalUserAmount = additionalAmount + gstAmount + insuranceAmount;
    let totalHostAmount = ((additionalAmount * hostCommission) - parseFloat(tds)).toFixed(2);
    const newBooking = await Booking.create({
      Bookingid: uuid.v4(),
      vehicleid: booking.vehicleid,
      startTripDate: booking.startTripDate,
      endTripDate: newEndDate,
      startTripTime: booking.startTripTime,
      endTripTime: newEndTime,
      id: userId,
      status: 1,
      amount: additionalAmount,
      GSTAmount: gstAmount,
      insurance: insuranceAmount,
      totalUserAmount: totalUserAmount,
      totalHostAmount: totalHostAmount,
      TDSAmount: tds,
    });

    if (bookingExtension) {
      bookingExtension.extendedBookings.push(newBooking.Bookingid);
      await bookingExtension.save();
    } else {
      await BookingExtension.create({
        bookingId,
        extendedBookings: [newBooking.Bookingid],
      });
    }

    res.status(200).json({ message: 'Booking extension requested successfully', newBooking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error processing extend booking request' });
  }
};


const breakup = async (req, res) => {
  try {
    let { vehicleid, startDate, endDate, startTime, endTime, features } = req.body;
    const dateValidation = validateBookingDates(startDate, endDate, startTime, endTime);
    if (!dateValidation.isValid) {
      return res.status(400).json({ message: dateValidation.error });
    }
    const cph = await Pricing.findOne({ where: { vehicleid: vehicleid } });
    const hours = calculateTripHours(startDate, endDate, startTime, endTime);
    if (!cph) {
      return res.status(404).json({ message: 'Pricing of the vehicle not available' });
    }
    let amount = Math.round(cph.costperhr * hours);

    let featureCost = 0;
    if (features) {
      for (const feature of features) {
        const featureDetail = await carFeature.findOne({ where: { featureid: feature, vehicleid: vehicleid } });
        if (featureDetail) {
          featureCost += featureDetail.price;
        }
      }
    }

    amount += featureCost;
    const costperhr = cph.costperhr;
    return res.status(200).json({
      totalHours: hours,
      costPerHr: costperhr,
      baseAmount: amount,
    });
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
      if (booking.status === 1 || booking.status === 5) {
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
        res.status(201).json({ message: 'Trip Has been Cancelled' });
      }
      else {
        res.status(404).json({ message: 'Ride Already Started' });
      }
    }
    else {
      // Fallback for Spintrip live cab bookings
      const cabBooking = await CabBookingRequest.findOne({ where: { bookingId } });
      if (cabBooking) {
        if (cabBooking.status === 'pending' || cabBooking.status === 'accepted') {
           const t = await sequelize.transaction();
           try {
             await CabBookingRequest.update(
               { status: 'cancelled' },
               { where: { bookingId }, transaction: t }
             );

             // --- 🪙 REFUND COINS ---
             await refundBookingCoins(bookingId, t);

             await t.commit();
             res.status(201).json({ message: 'Trip Has been Cancelled' });
           } catch (err) {
             await t.rollback();
             console.error("Cancellation error:", err);
             res.status(500).json({ message: 'Error processing cancellation' });
           }
        } else {
           res.status(404).json({ message: 'Ride Already Started' });
        }
      } else {
        res.status(404).json({ message: 'Booking Not found' });
      }
    }
  }
  catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

const userbookings = async (req, res) => {
  try {
    let userId = req.user.userid;
    const bookings = await Booking.findAll({ where: { id: userId } });
    const cabBookings = await CabBookingRequest.findAll({ where: { userId } });
    const user = await User.findOne({ where: { id: userId } });
    if (bookings && bookings.length > 0) {
      const featureList = await Feature.findAll();
      const featureMap = featureList.reduce((map, feature) => {
        map[feature.id] = feature.featureName;
        return map;
      }, {});

      const userBookingPromises = bookings.map(async (booking) => {
        const vehicle = await Vehicle.findOne({ where: { vehicleid: booking.vehicleid } });
        if (!vehicle) {
          return null;
        }

        const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: booking.vehicleid } });
        let vehicleModel;
        if (vehicle.vehicletype == 2) {
          const car = await Car.findOne({ where: { vehicleid: vehicle.vehicleid } });
          if (car.brand) {
            vehicleModel = car.brand.charAt(0).toUpperCase() + car.brand.slice(1).toLowerCase();
          }
        }
        if (vehicle.vehicletype == 3) {
          const cab = await Cab.findOne({ where: { vehicleid: vehicle.vehicleid } });
          if (cab.brand) {
            vehicleModel = cab.brand.charAt(0).toUpperCase() + cab.brand.slice(1).toLowerCase();
          }
        }
        if (vehicle.vehicletype == 1) {
          const bike = await Bike.findOne({ where: { vehicleid: vehicle.vehicleid } });
          if (bike.brand) {
            vehicleModel = bike.brand.charAt(0).toUpperCase() + bike.brand.slice(1).toLowerCase();
          }
        }
        const transaction = await Transaction.findOne({ where: { Transactionid: booking.Transactionid } });

        const featureDetails = (booking.features || []).map(featureId => ({
          featureId,
          featureName: featureMap[featureId] || 'Unknown Feature'
        }));
        let pickup = null;
        let destination = null;
        let driver = null;
        if (vehicle.vehicletype == 3) {
          // parse pickup/drop JSON safely
          pickup = booking.pickup ? booking.pickup : null;
          destination = booking.destination ? booking.destination : null;

          if (booking.driverid) {
            const driverData = await Driver.findOne({ where: { id: booking.driverid } });
            const driverAdditional = await DriverAdditional.findOne({ where: { id: booking.driverid } });
            const Driverphone = await User.findOne({ where: { id: booking.driverid } });
            if (driverData) {
              driver = {
                id: driverData.id,
                name: driverAdditional?.FullName || driverData.name || null,
                phone: Driverphone?.phone || Driverphone.phone || null
              };
            }
          }
        }
        console.log(vehicle.Rcnumber)
        return {
          bookingId: booking.Bookingid,
          vehicleid: checkData(booking.vehicleid),
          id: checkData(booking.id),
          status: checkData(booking.status),
          amount: checkData(booking.amount),
          startTripDate: checkData(booking.startTripDate),
          endTripDate: checkData(booking.endTripDate),
          startTripTime: checkData(booking.startTripTime),
          endTripTime: checkTime(booking.endTripTime),
          hostId: checkData(vehicle.hostId),
          vehicleModel: vehicleModel,
          vehicletype: vehicle.vehicletype,
          vehicleImage1: checkImage(vehicleAdditional.vehicleImage1),
          vehicleImage2: checkImage(vehicleAdditional.vehicleImage2),
          vehicleImage3: checkImage(vehicleAdditional.vehicleImage3),
          vehicleImage4: checkImage(vehicleAdditional.vehicleImage4),
          vehicleImage5: checkImage(vehicleAdditional.vehicleImage5),
          rcNumber: vehicle ? checkData(vehicle.Rcnumber) : "Not Provided", 
          latitude: checkData(vehicleAdditional.latitude),
          longitude: checkData(vehicleAdditional.longitude),
          cancelDate: checkData(booking.cancelDate),
          cancelReason: checkData(booking.cancelReason),
          features: featureDetails,
          pickup: pickup,
          destination: destination,
          driver: driver,
          userOtp: user.otp,
          createdAt: checkData(booking.createdAt)

        };
      });

      const userBookings = (await Promise.all(userBookingPromises)).filter(booking => booking !== null);

      // PARSE AND FORMAT NEW CAB BOOKING REQUESTS
      const taxRow = await Tax.findOne({ order: [['createdAt', 'DESC']] });
      const GST_RATE = taxRow ? taxRow.GST : 5.0;
      const COMMISSION_RATE = taxRow ? taxRow.cabCommission : 20.0;
      const TDS_RATE = taxRow ? taxRow.TDS : 5.0;
      const cabBookingPromises = cabBookings.map(async (cab) => {
        const vehicle = cab.vehicleId ? await Vehicle.findOne({ where: { vehicleid: cab.vehicleId } }) : null;
        let vehicleModel = cab.cabType || "Mini Cab";
        let vehicleImage1 = noVehicleImg;
        if (vehicle) {
          const cabData = await Cab.findOne({ where: { vehicleid: vehicle.vehicleid } });
          const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: vehicle.vehicleid } });
          if (cabData && cabData.brand) vehicleModel = cabData.brand.charAt(0).toUpperCase() + cabData.brand.slice(1).toLowerCase();
          if (vehicleAdditional && vehicleAdditional.vehicleImage1) vehicleImage1 = vehicleAdditional.vehicleImage1;
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
        let intStatus = 5; // Default Booking Confirmed
        if (cab.status === 'accepted' || cab.status === 'assigned') intStatus = 1;
        if (cab.status === 'started' || cab.status === 'ongoing') intStatus = 2;
        if (cab.status === 'completed') intStatus = 3;
        if (cab.status === 'cancelled' || cab.paymentStatus === 'failed') intStatus = 4;
        if (cab.status === 'rated' ) intStatus = 6;

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
        const netBaseAmount = amt / 1.05;
        const gstOut = amt - netBaseAmount;
        const commOut = netBaseAmount * 0.20;
        const tdsOut = netBaseAmount * 0.01; // 1% Gross
        const dEarn = Math.round((netBaseAmount - commOut - tdsOut) * 100) / 100;

        return {
          bookingId: cab.bookingId,
          vehicleid: cab.vehicleId || "",
          id: cab.userId,
          status: intStatus,
          amount: amt,
          gstAmount: Math.round(gstOut * 100) / 100,
          commissionAmount: Math.round(commOut * 100) / 100,
          tdsAmount: Math.round(tdsOut * 100) / 100,
          driverEarnings: dEarn,
          confirmationFee: cab.confirmationFee || Math.round((amt - dEarn) * 100) / 100,
          payToDriver: cab.payToDriver || dEarn,
          startTripDate: checkData(cab.date || cab.createdAt.toISOString().split('T')[0]),
          endTripDate: checkData(cab.date || cab.createdAt.toISOString().split('T')[0]),
          startTripTime: checkData(cab.time || cab.createdAt.toISOString().split('T')[1].slice(0, 5)),
          endTripTime: checkTime(cab.endTripTime),
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
          rcNumber: vehicle ? checkData(vehicle.Rcnumber) : "Not Provided", 
          userOtp: (await CabBookingAccepted.findOne({ where: { bookingId: cab.bookingId } }))?.tripOtp || cab.otp || user.otp,
          createdAt: checkData(cab.createdAt)
        };
      });

      const formattedCabBookings = (await Promise.all(cabBookingPromises)).filter(b => b !== null);
      
      const allUserBookings = [...userBookings, ...formattedCabBookings];
      // Sort unified list cleanly by Date Created
      allUserBookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.status(201).json({ message: allUserBookings });
    } else if (cabBookings && cabBookings.length > 0) {
      // Edge case: user never rented a car, only booked a cab. 
      // The massive if statement on line 676 failed. We must gracefully catch it here and duplicate the logic.
       const cabBookingPromises = cabBookings.map(async (cab) => {
        const vehicle = cab.vehicleId ? await Vehicle.findOne({ where: { vehicleid: cab.vehicleId } }) : null;
        let vehicleModel = cab.cabType || "Mini Cab";
        let vehicleImage1 = noVehicleImg;
        if (vehicle) {
          const cabData = await Cab.findOne({ where: { vehicleid: vehicle.vehicleid } });
          const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: vehicle.vehicleid } });
          if (cabData && cabData.brand) vehicleModel = cabData.brand.charAt(0).toUpperCase() + cabData.brand.slice(1).toLowerCase();
          if (vehicleAdditional && vehicleAdditional.vehicleImage1) vehicleImage1 = vehicleAdditional.vehicleImage1;
        }
        // Map Status string to Int (1=Upcoming, 2=Ongoing, 3=Complete, 4=Cancelled, 5=Confirmed, 6=Reviewed)
        let intStatus = 5; // Default Booking Confirmed
        if (cab.status === 'accepted' || cab.status === 'assigned') intStatus = 1;
        if (cab.status === 'started' || cab.status === 'ongoing') intStatus = 2;
        if (cab.status === 'completed') intStatus = 3;
        if (cab.status === 'cancelled' || cab.paymentStatus === 'failed') intStatus = 4;
        if (cab.status === 'rated') intStatus = 6;

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
        const netBaseAmount = amt / 1.05;
        const gstOut = amt - netBaseAmount;
        const commOut = netBaseAmount * 0.20;
        const tdsOut = netBaseAmount * 0.01; // 1% Gross
        const dEarn = Math.round((netBaseAmount - commOut - tdsOut) * 100) / 100;

        return {
          bookingId: cab.bookingId,
          vehicleid: cab.vehicleId || "",
          id: cab.userId,
          status: intStatus,
          amount: amt,
          gstAmount: Math.round(gstOut * 100) / 100,
          commissionAmount: Math.round(commOut * 100) / 100,
          tdsAmount: Math.round(tdsOut * 100) / 100,
          driverEarnings: dEarn,
          confirmationFee: cab.confirmationFee || Math.round((amt - dEarn) * 100) / 100,
          payToDriver: cab.payToDriver || dEarn,
          startTripDate: checkData(cab.date || cab.createdAt.toISOString().split('T')[0]),
          endTripDate: checkData(cab.date || cab.createdAt.toISOString().split('T')[0]),
          startTripTime: checkData(cab.time || cab.createdAt.toISOString().split('T')[1].slice(0, 5)),
          endTripTime: checkTime(cab.endTripTime),
          hostId: vehicle ? vehicle.hostId : "",
          vehicleModel: vehicleModel,
          vehicletype: 3, 
          vehicleImage1: vehicleImage1,
          vehicleImage2: noVehicleImg,
          vehicleImage3: noVehicleImg,
          vehicleImage4: noVehicleImg,
          vehicleImage5: noVehicleImg,
          latitude: cab.startLocationLatitude,
          longitude: cab.startLocationLongitude,
          cancelDate: null,
          cancelReason: null,
          rcNumber: vehicle ? checkData(vehicle.Rcnumber) : "Not Provided",
          features: [],
          pickup: pickupObj,
          destination: destObj,
          driver: cabDriver,
          userOtp: (await CabBookingAccepted.findOne({ where: { bookingId: cab.bookingId } }))?.tripOtp || cab.otp || user.otp,
          createdAt: checkData(cab.createdAt)
        };
      });

      let formattedCabBookings = (await Promise.all(cabBookingPromises)).filter(b => b !== null);
      formattedCabBookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      res.status(201).json({ message: formattedCabBookings });
    } else {
      res.status(200).json({ message: [] });
    }
  } catch (err) {
    require('fs').appendFileSync('C:/Users/Admin/Spintrip New Vision/cab_error.txt', new Date().toISOString() + '\\nUserBookings Crash: ' + (err.stack || err.message) + '\\n\\n');
    console.error(err);
    res.status(500).json({ message: 'Server error: ' + (err.message || '') });
  }
}

const getfeedback = async (req, res) => {
  try {
    const { vehicleid } = req.body;
    const feedback = await Feedback.findAll(
      { where: { vehicleid: vehicleid } }
    );
    if (feedback) {
      res.status(201).json({ message: feedback });
    }
    else {
      res.status(404).json({ message: 'No Feedback present' });
    }
  }
  catch (err) {
    res.status(500).json({ message: 'Server error' });
  }

}
const transactions = async (req, res) => {
  try {
    const userId = req.user.id;
    let transactions = [];
    const bookings = await Booking.findAll({ where: { id: userId } });
    console.log(bookings);

    for (let i = 0; i < bookings.length; i++) {
      const bookingTransactions = await Transaction.findAll({ where: { Bookingid: bookings[i].Bookingid } });
      transactions = transactions.concat(bookingTransactions); // Concatenate the transactions
    }

    console.log(transactions);

    res.status(200).json({ message: 'Transactions for the user', transactions: transactions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}


const rating = async (req, res) => {
  try {
    let { bookingId, rating, feedback } = req.body;
    if (!rating) {
      rating = 5;
    }
    const userId = req.user.id;
    const user = await UserAdditional.findOne({
      where: { id: userId }
    });

    // 1. Find the booking in either Rentals or Cab table
    let booking = await Booking.findOne({
      where: { Bookingid: bookingId }
    });

    let isCab = false;
    if (!booking) {
      booking = await CabBookingRequest.findOne({ where: { bookingId: bookingId } });
      isCab = true;
    }

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // 2. Identify the vehicle
    const vehicleIdVal = isCab ? booking.vehicleId : booking.vehicleid;
    const vehicle = await Vehicle.findOne({
      where: { vehicleid: vehicleIdVal }
    });

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    // 3. ✅ FIX: Correctly count total bookings to calculate the average
    let bookingCount = 1;
    if (!isCab) {
      bookingCount = await Booking.count({
        where: {
          vehicleid: vehicle.vehicleid,
          status: { [Op.in]: [3, 6] } // Count both 'Completed' and 'Already Rated' trips
        }
      });
    } else {
      // Correctly count completed live cab bookings
      bookingCount = await CabBookingRequest.count({
        where: {
          vehicleId: vehicle.vehicleid,
          status: { [Op.in]: ['completed', 'rated'] }
        }
      });
    }
    if (bookingCount === 0) bookingCount = 1;

    // 4. Calculate Moving Average Rating
    let new_rating;
    if (bookingCount == 1) {
      new_rating = parseFloat(rating);
    } else {
      // new = (new_rating + (old_avg * count-1)) / count
      new_rating = (parseFloat(rating) + parseFloat(vehicle.rating * (bookingCount - 1))) / bookingCount;
    }

    await vehicle.update({ rating: new_rating });

    // 5. Save the text Feedback
    if (feedback) {
      await Feedback.create({
        vehicleid: vehicle.vehicleid,
        userId: userId,
        userName: user?.FullName || 'User',
        hostId: isCab ? (booking.driverId || booking.driverid) : vehicle.hostId, // Support both driver ID variants
        rating: rating,
        comment: feedback
      });
    }

    // 6. ✅ FIX: Mark status as Rated to fully close the cycle
    try {
      if (isCab) {
        await booking.update({ status: 'rated' });
      } else {
        await booking.update({ status: 6 });
      }
    } catch (ignoreStatusErr) {
       console.log("Status update failed:", ignoreStatusErr.message);
    }

    res.status(200).json({ 
      message: feedback ? 'Thank you for your response with feedback' : 'Thank you for your response' 
    });

  } catch (error) {
    console.error("Rating error:", error);
    res.status(500).json({ message: 'Server error' });
  }
};


module.exports = { booking, extend, breakup, cancelbooking, userbookings, getfeedback, transactions, rating };