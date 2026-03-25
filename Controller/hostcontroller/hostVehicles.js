const { Host, Car, Cab, User, Listing, HostAdditional, UserAdditional, Booking, Pricing, Subscriptions, Brand, Feedback, Driver, carFeature, Feature, Blog, carDevices, Device, Transaction, Vehicle, Bike, VehicleAdditional, HostPayment } = require('../../Models');
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../../s3Config');
const path = require('path');
const uuid = require('uuid');
const { Sequelize, Op, where } = require('sequelize');;
const { npm } = require('winston/lib/winston/config');
const hostPaymentModel = require('../../Models/hostPaymentModel');
const bikeModel = require('../../Models/bikeModel');
const { sendPushNotification } = require('../../Utils/notificationService');
const noImgPath = `https://spintrip-s3bucket.s3.ap-south-1.amazonaws.com/vehicleAdditional/no_image.png`;


const vehicleImageStorage = multerS3({
  s3: s3,
  bucket: 'spintrip-s3bucket',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const vehicleid = req.body.vehicleid;
    let fileName = '';
    if (file.fieldname.includes('_')) {
        const imageNumber = file.fieldname.split('_')[1];
        fileName = `vehicleImage_${imageNumber}${path.extname(file.originalname)}`;
    } else {
        fileName = `${file.fieldname}${path.extname(file.originalname)}`; // e.g rcFile.jpg
    }
    cb(null, `vehicleAdditional/${vehicleid}/${fileName}`);
  }
});
const vehicleImageFields = Array.from({ length: 5 }, (_, i) => ({ name: `vehicleImage_${i + 1}` }));
vehicleImageFields.push({ name: 'rcFile', maxCount: 1 });
vehicleImageFields.push({ name: 'pucFile', maxCount: 1 });
const uploadvehicleImages = multer({ storage: vehicleImageStorage }).fields(vehicleImageFields);


async function deleteFromS3(key) {
  try {
    const params = {
      Bucket: 'spintrip-s3bucket',
      Key: key,
    };

    await s3.send(new DeleteObjectCommand(params));
    console.log(`Successfully deleted ${key}`);
  } catch (error) {
    console.error(`Error deleting ${key}`, error);
  }
}

// const getAllowedHostIds = async (hostId) => {
//   const host = await Host.findOne({ where: { id: hostId } });

//   let hostIds = [hostId];

//   if (host && host.parentHostId === null) {
//     const vendors = await Host.findAll({
//       where: { parentHostId: hostId }
//     });

//     vendors.forEach(v => hostIds.push(v.id));
//   }

//   return hostIds;
// };

const postVehicle = async (req, res) => {
  const { vehicletype } = req.body;

  try {
    if (vehicletype === '3') {
      return res.status(400).json({ message: "To add a Cab, please explicitly use the dedicated /api/cab/add-cab endpoint to ensure correct driver mappings." });
    }

    // For other vehicle types, handle the logic here (e.g., bikes or cars)
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
      permitNumber,
      serviceType,
      seatingCapacity,
      vendorid,
    } = req.body;
    console.log(req.body);
    const requiredFields = {
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
    }
    const requiredFieldsSubset = ['rcNumber', 'vehicleModel', 'registrationYear'];
    const missingFields = Object.entries(requiredFieldsSubset)
      .filter(([key, value]) => requiredFieldsSubset.includes(key) && (value == "" || value == null))
      .map(([key]) => key);

    if (missingFields.length > 0) {
      // Return a 400 error with the missing fields
      return res.status(400).json({
        message: 'Missing required fields',
        missingFields,
      });
    }
    // Check if user is Host or Driver
    const host = await Host.findByPk(req.user.id);
    const driver = await Driver.findByPk(req.user.id);

    if (!host && !driver) {
      return res.status(401).json({ message: 'Host/Driver not found' });
    }

    // Role Enforcement: Drivers can ONLY add cabs (vehicletype = 3)
    if (req.user.role === 'Driver' && vehicletype !== '3') {
      return res.status(403).json({ message: 'Forbidden: Drivers can only add Cabs (vehicletype 3).' });
    }

    const vehicleId = uuid.v4();

    const vehicle = await Vehicle.create({
      vehicletype,
      chassisno: chassisNo || '0',
      Rcnumber: rcNumber,
      Enginenumber: engineNumber || '0',
      Registrationyear: registrationYear,
      vehicleid: vehicleId,
      hostId: vendorid ? vendorid : req.user.id,
      timestamp: timeStamp,
      activated: false,
    });

    await VehicleAdditional.create({
      vehicleid: vehicleId,
      latitude,
      longitude,
      address,
    });

    if (vehicletype === '1') {
      await Bike.create({
        vehicleid: vehicleId,
        bikemodel: vehicleModel,
        type,
        brand,
        variant,
        color,
        bodytype: bodyType,
        city,
      });
    }

    if (vehicletype === '2') {
      await Car.create({
        vehicleid: vehicleId,
        carmodel: vehicleModel,
        type,
        brand,
        variant,
        color,
        bodytype: bodyType,
        city,
      });
    }




    if (vehicletype !== '3') {
      await Pricing.create({
        vehicleid: vehicleId,
      });
    }

    const listingId = uuid.v4();

    await Listing.create({
      id: listingId,
      vehicleid: vehicleId,
      hostid: vendorid ? vendorid : req.user.id,
    });
    console.log('Vehicle created with ID:', vehicleId);
    console.log('Listing created with ID:', listingId);
    console.log('vendorid:', vendorid ? vendorid : req.user.id);
    res.status(201).json({
      message: 'Vehicle and listing added successfully for the host',
      vehicle,
    });
  } catch (error) {
    console.error('Error adding vehicle:', error.message);
    res.status(500).json({ message: 'Error adding vehicle', error });
  }
};

const putVehicleAdditional = async (req, res) => {
  try {
    const {
      vehicleid,
      horsePower,
      latitude,
      longitude,
      address,
      ac,
      musicSystem,
      autoWindow,
      sunroof,
      touchScreen,
      sevenSeater,
      reverseCamera,
      transmission,
      airBags,
      fuelType,
      petFriendly,
      powerSteering,
      abs,
      tractionControl,
      fullBootSpace,
      keylessEntry,
      airPurifier,
      cruiseControl,
      voiceControl,
      usbCharger,
      bluetooth,
      airFreshner,
      ventelatedFrontSeat,
      helmet,
      helmetSpace,
      costperhr,
      priceperkm,
      packagePrice,
      pricingType,
      fixedPrice,
      baseKm,
      extraKmPrice,
      additionalInfo
    } = req.body;



    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid } });
    if (!vehicle) {
      return res.status(400).json({ message: 'Vehicle not found' });
    }

    const updateData = {
      latitude: latitude,
      longitude: longitude,
      address: address,
      Additionalinfo: additionalInfo,
      verification_status: 1,
    };

    const imageFields = {
      vehicleImage_1: 'vehicleimage1',
      vehicleImage_2: 'vehicleimage2',
      vehicleImage_3: 'vehicleimage3',
      vehicleImage_4: 'vehicleimage4',
      vehicleImage_5: 'vehicleimage5'
    };

    const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: vehicleid } });


    for (const [requestField, dbField] of Object.entries(imageFields)) {
      if (req.files[requestField]) {
        updateData[dbField] = req.files[requestField][0].location;
      } else if (req.body[requestField] == '') {
        const imageKey = vehicleAdditional[dbField];
        if (imageKey) {
          await deleteFromS3(imageKey);
          updateData[dbField] = null;
        }
      }
    }

    if (req.files['rcFile'] && req.files['rcFile'][0]) {
      await Vehicle.update(
        { RcImage: req.files['rcFile'][0].location },
        { where: { vehicleid: vehicleid } }
      );
    }

    if (req.files['pucFile'] && req.files['pucFile'][0]) {
      await Vehicle.update(
        { PucImage: req.files['pucFile'][0].location },
        { where: { vehicleid: vehicleid } }
      );
    }

    const updatedvehicleAdditional = await vehicleAdditional.update(updateData, { where: { vehicleid: vehicleid } });

    const pricingPayload = {
      costperhr: costperhr || null,
    };

    let price = await Pricing.findOne({ where: { vehicleid } });

    if (price) {
      await price.update(pricingPayload);
    } else {
      await Pricing.create({
        vehicleid,
        ...pricingPayload,
      });
    }
    let Additional;
    if (vehicle.vehicletype == 1) {
      Additional = await Bike.findOne({ where: { vehicleid: vehicleid } });
      await Additional.update({
        HorsePower: horsePower, helmet: helmet, helmetSpace: helmetSpace, FuelType: fuelType
      })
    }
    if (vehicle.vehicletype == 2) {
      Additional = await Car.findOne({ where: { vehicleid: vehicleid } });
      console.log(ac);
      const additional1 = await Additional.update({
        HorsePower: horsePower,
        AC: ac,
        Musicsystem: musicSystem,
        Autowindow: autoWindow,
        Sunroof: sunroof,
        Touchscreen: touchScreen,
        Sevenseater: sevenSeater,
        Reversecamera: reverseCamera,
        Transmission: transmission,
        Airbags: airBags,
        FuelType: fuelType,
        PetFriendly: petFriendly,
        PowerSteering: powerSteering,
        ABS: abs,
        tractionControl: tractionControl,
        fullBootSpace: fullBootSpace,
        KeylessEntry: keylessEntry,
        airPurifier: airPurifier,
        cruiseControl: cruiseControl,
        voiceControl: voiceControl,
        usbCharger: usbCharger,
        bluetooth: bluetooth,
        airFreshner: airFreshner,
        ventelatedFrontSeat: ventelatedFrontSeat
      })
      console.log(additional1);
    }
    if (vehicle.vehicletype == 3) {
      Additional = await Cab.findOne({ where: { vehicleid: vehicleid } });
    }
    const vehicleAdditionals = {
      vehicleid: updatedvehicleAdditional.vehicleid,
      vehicleImage1: updatedvehicleAdditional.vehicleimage1,
      vehicleImage2: updatedvehicleAdditional.vehicleimage2,
      vehicleImage3: updatedvehicleAdditional.vehicleimage3,
      vehicleImage4: updatedvehicleAdditional.vehicleimage4,
      vehicleImage5: updatedvehicleAdditional.vehicleimage5,
      latitude: updatedvehicleAdditional.latitude,
      longitude: updatedvehicleAdditional.longitude,
      address: updatedvehicleAdditional.address,
      verificationStatus: updatedvehicleAdditional.verification_status,
    };

    res.status(201).json({ message: 'Vehicle Additional added', vehicleAdditionals, Additional });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error Adding Vehicle Additional Details' });
  }
};

const assignDriver = async (req, res) => {
  try {

    const { carId, driverId } = req.body;
    const hostId = req.user.id;
    console.log(carId, driverId, hostId);

    const car = await Cab.findOne({ where: { vehicleid: carId } });
    if (!car) return res.status(404).json({ message: "Car not found" });

    const driver = await Driver.findOne({ where: { id: driverId, hostid: hostId } });
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    console.log(driverId);

    await Cab.update({ driverId: driverId }, { where: { vehicleid: carId } });

    if (driver.fcmToken) {
      await sendPushNotification(driver.fcmToken, "New Ride Assigned", "You have been assigned a new Cab by the Fleet Admin!");
    }

    res.status(200).json({ message: "Driver assigned successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error assigning driver", error });
  }
};
const postPricing = async (req, res) => {
  try {
    const { vehicleid } = req.body;
    const Price = await Pricing.findOne({ where: { vehicleid: vehicleid } })
    if (Price) {
      res.status(201).json({ "message": "price for the vehicle", vehicleid: Price.vehicleid, costPerHr: Price.costperhr });
    }
    else {
      res.status(400).json({ "message": "pricing cannot be found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error checking Pricing' });
  }
};


const getVehicleAdditional = async (req, res) => {
  const { vehicleid } = req.body;
  const hostId = req.user.id; // Assuming the host ID is part of the authenticated user details

  try {
    // Check if the host owns the vehicle
    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid } });
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found or unauthorized access' });
    }

    const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: vehicleid } });
    if (!vehicleAdditional) {
      return res.status(404).json({ message: 'Vehicle additional information not found' });
    }

    const safeBoolean = (value) => (value !== null && value !== undefined ? value : false);
    // const checkImage = (value) => {
    //   return (value !== null && value !== undefined ? value : noImgPath);
    // }
    const checkData = (value) => {
      return value !== null && value !== undefined ? value : 'Not Provided';
    }
    const pricing = await Pricing.findOne({ where: { vehicleid: vehicleid } })
    let booleanSpecs = [];
    let additional = {};
    const features = await carFeature.findAll({ where: { vehicleid: vehicleid } });
    const featureList = await Feature.findAll();
    const featureMap = featureList.reduce((map, f) => (map[f.id] = f.featureName, map), {});

    const updatedFeatures = features.map(f => ({
      ...f.dataValues,
      featureName: featureMap[f.featureid]
    }));

    if (vehicle.vehicletype == 1) {
      // Bike-specific fields
      const bikeDetails = await Bike.findOne({ where: { vehicleid: vehicleid } });
      additional = {
        vehicleModel: bikeDetails?.bikemodel,
        horsePower: bikeDetails?.HorsePower || 0,
        fueltype: bikeDetails?.FuelType,
        type: checkData(bikeDetails?.type),
        brand: checkData(bikeDetails?.brand),
        variant: checkData(bikeDetails?.variant),
        color: checkData(bikeDetails?.color),
        bodyType: checkData(bikeDetails?.bodytype),
        costperhr: pricing?.costperhr || null,
      };

      // Populate booleanSpecs for bikes
      booleanSpecs = [
        // { field_name: "fuelType", title: "Fuel Type", value: safeBoolean(bikeDetails?.FuelType), logo: "" },
        { field_name: "helmet", title: "Helmet", value: safeBoolean(bikeDetails?.helmet), logo: "" },
        { field_name: "helmetSpace", title: "Helmet Space", value: safeBoolean(bikeDetails?.helmetSpace), logo: "" },
      ];
    }


    if (vehicle.vehicletype == 2) {
      // Car-specific fields
      const carDetails = await Car.findOne({ where: { vehicleid: vehicleid } });
      additional = {
        vehicleModel: carDetails?.carmodel || "None",
        horsePower: carDetails?.HorsePower || "None",
        type: carDetails?.type || "None",
        brand: carDetails?.brand || "None",
        variant: carDetails?.variant || "None",
        color: carDetails?.color || "None",
        bodyType: "None",
        costperhr: pricing.costperhr,
      };

      // Populate booleanSpecs for cars
      booleanSpecs = [
        { title: "Air Conditioning", value: safeBoolean(carDetails?.AC), field_name: "ac", logo: "" },
        { title: "Music System", value: safeBoolean(carDetails?.Musicsystem), field_name: "musicSystem", logo: "" },
        { title: "Auto Window", value: safeBoolean(carDetails?.Autowindow), field_name: "autoWindow", logo: "" },
        { title: "Sunroof", value: safeBoolean(carDetails?.Sunroof), field_name: "sunroof", logo: "" },
        { title: "Touchscreen", value: safeBoolean(carDetails?.Touchscreen), field_name: "touchscreen", logo: "" },
        { title: "Seven Seater", value: safeBoolean(carDetails?.Sevenseater), field_name: "sevenSeater", logo: "" },
        { title: "Reverse Camera", value: safeBoolean(carDetails?.Reversecamera), field_name: "reverseCamera", logo: "" },
        { title: "Transmission", value: safeBoolean(carDetails?.Transmission), field_name: "transmission", logo: "" },
        { title: "Airbags", value: safeBoolean(carDetails?.Airbags), field_name: "airbags", logo: "" },
        { title: "Fuel Type", value: checkData(carDetails?.FuelType), field_name: "fuelType", logo: "" },
        { title: "Pet Friendly", value: safeBoolean(carDetails?.PetFriendly), field_name: "petFriendly", logo: "" },
        { title: "Power Steering", value: safeBoolean(carDetails?.PowerSteering), field_name: "powerSteering", logo: "" },
        { title: "ABS", value: safeBoolean(carDetails?.ABS), field_name: "abs", logo: "" },
        { title: "Traction Control", value: safeBoolean(carDetails?.tractionControl), field_name: "tractionControl", logo: "" },
        { title: "Full Boot Space", value: safeBoolean(carDetails?.fullBootSpace), field_name: "fullBootSpace", logo: "" },
        { title: "Keyless Entry", value: safeBoolean(carDetails?.KeylessEntry), field_name: "keylessEntry", logo: "" },
        { title: "Air Purifier", value: safeBoolean(carDetails?.airPurifier), field_name: "airPurifier", logo: "" },
        { title: "Cruise Control", value: safeBoolean(carDetails?.cruiseControl), field_name: "cruiseControl", logo: "" },
        { title: "Voice Control", value: safeBoolean(carDetails?.voiceControl), field_name: "voiceControl", logo: "" },
        { title: "USB Charger", value: safeBoolean(carDetails?.usbCharger), field_name: "usbCharger", logo: "" },
        { title: "Bluetooth", value: safeBoolean(carDetails?.bluetooth), field_name: "bluetooth", logo: "" },
        { title: "Air Freshener", value: safeBoolean(carDetails?.airFreshner), field_name: "airFreshener", logo: "" },
        { title: "Ventilated Front Seat", value: safeBoolean(carDetails?.ventelatedFrontSeat), field_name: "ventilatedFrontSeat", logo: "" }
      ];
    }

    if (vehicle.vehicletype == 3) {
      // Car-specific fields
      const cabDetails = await Cab.findOne({ where: { vehicleid: vehicleid } });
      additional = {
        vehicleModel: cabDetails?.model || "None",
        driverId: cabDetails?.driverId || "None",
      };

      // Populate booleanSpecs for cars

    }

    const vehicleAdditionals = {
      vehicleId: vehicle.vehicleid,
      vehicleType: vehicle.vehicletype,
      latitude: vehicleAdditional.latitude,
      longitude: vehicleAdditional.longitude,
      rcNumber: vehicle.Rcnumber,
      rcImage: vehicle.RcImage || "None",
      pucImage: vehicle.PucImage || "None",
      registrationYear: vehicle.Registrationyear,
    };
    const vehicleImages = [
      vehicleAdditional.vehicleimage1,
      vehicleAdditional.vehicleimage2,
      vehicleAdditional.vehicleimage3,
      vehicleAdditional.vehicleimage4,
      vehicleAdditional.vehicleimage5
    ];
    if (vehicleImages) {
      res.status(200).json({
        message: "vehicle Additional data",
        vehicleAdditionals,
        additional,
        booleanSpecs,
        vehicleImages,
        updatedFeatures
      });
    }
    else {
      res.status(200).json({
        message: "vehicle Additional data, no image found",
        vehicleAdditionals,
        additional,
        booleanSpecs,
        updatedFeatures
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getAllSubscriptions = async (req, res) => {
  try {
    const { vehicleType } = req.body;

    let subscriptions;

    if (vehicleType) {
      subscriptions = await Subscriptions.findAll({
        where: {
          vehicleType: vehicleType,
        },
      });
    } else {
      subscriptions = await Subscriptions.findAll();
    }

    // If no subscriptions are found
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ message: 'No subscriptions found for the given criteria' });
    }

    // Return the list of subscriptions
    res.status(200).json({
      message: 'Subscriptions fetched successfully',
      subscriptions: subscriptions,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: 'Error fetching subscriptions',
      error: error.message,
    });
  }
};


const activateVehicle = async (req, res) => {
  const { paymentMethod, planType } = req.body;
  try {
    const host = await Host.findByPk(req.user.id);
    if (!host) {
      return res.status(401).json({ message: 'No Host found' });
    }


    const subscription = await Subscriptions.findOne({ where: { PlanType: planType } });
    if (!subscription) {
      return res.status(404).json({ message: 'No Subscription record found' });
    }
    const vehicle = await Vehicle.findAll({ where: { hostId: req.user.id, vehicletype: String(subscription.vehicleType), } });
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    const expiryDays = subscription.expiry * 30;
    const planEndDate = new Date();
    planEndDate.setDate(planEndDate.getDate() + expiryDays);
    const paymentId = uuid.v4();
    const amount = subscription.amount;
    const hostPayment = await HostPayment.create({
      PaymentId: paymentId,
      HostId: req.user.id,
      PlanType: planType,
      PaymentDate: new Date(),
      PlanEndDate: planEndDate,
      Amount: amount,
      GSTAmount: amount * 0.05,
      TotalAmount: amount * 1.05,
      PaymentStatus: 1, // Assuming 1 means successful
      PaymentMethod: paymentMethod ? paymentMethod : 'Cashfree',
      Remarks: 'Vehicle activation payment'
    });
    console.log(hostPayment);
    const vehicles = await Vehicle.update(
      { activated: true },
      {
        where: {
          hostId: req.user.id,
          vehicletype: subscription.vehicleType,
        },
      }
    );
    res.status(200).json({ message: 'Vehicle activated successfully', vehicles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error activating vehicle' });
  }
};

const getActiveSubscriptionForVehicle = async (req, res) => {

  try {

    const subscription = await HostPayment.findAll({
      where: {
        HostId: req.user.id,
        PlanEndDate: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!subscription) {
      return res.status(404).json({ message: 'No active subscription found for this vehicle' });
    }

    // Return the active subscription details
    res.status(200).json({
      message: 'Active subscription fetched successfully',
      subscription: subscription,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Error fetching active subscription for vehicle',
      error: error.message,
    });
  }
};


const postMonthlyData = async (req, res) => {
  const { vehicleid } = req.body;
  try {
    const monthlyData = await Booking.findAll({
      attributes: [
        [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('endTripDate')), 'month'],
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'totalAmount'],
        [Sequelize.fn('COUNT', Sequelize.col('Bookingid')), 'numberOfBookings']
      ],
      where: {
        vehicleid: vehicleid,
        endTripDate: {
          [Op.ne]: null // Ensure the Date is not null
        },
        status: '3',
      },
      group: [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('endTripDate'))],
      order: [[Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('endTripDate')), 'ASC']]
    });

    const formattedMonthlyData = monthlyData.map(row => ({
      month: row.get('month'),
      totalAmount: row.get('totalAmount'),
      numberOfBookings: row.get('numberOfBookings')
    }));

    res.status(200).json({
      monthlyData: formattedMonthlyData,
    });
  } catch (error) {
    console.error('Error fetching monthly data:', error);
  }
};
const pauseCab = async (req, res) => {
  try {
    const { listingid } = req.body;

    const listing = await Listing.findOne(
      { where: { id: listingid } }
    );

    const cab = await Cab.findOne(
      { where: { vehicleid: listing.vehicleid } }
    );
    if (cab?.driverId) {

      await Driver.update(
        { isActive: false },
        { where: { id: cab.driverId } }
      );

      res.status(201).json({ message: 'Cab paused successfully' });
    }
    else {
      res.status(404).json({ message: 'Cab is already paused' });
    }
  }
  catch (err) {
    res.status(500).json({ message: 'Server error' });
  }

};

const resumeCab = async (req, res) => {
  try {
    const { vehicleid } = req.body;
    const cab = await Cab.findOne(
      { where: { vehicleid: vehicleid } }
    );
    if (cab?.driverId) {

      await Driver.update(
        { isActive: true },
        { where: { id: cab.driverId } }
      );

      res.status(201).json({ message: 'Cab resumed successfully' });
    }
    else {
      res.status(404).json({ message: 'Cab is already resumed' });
    }
  }
  catch (err) {
    res.status(500).json({ message: 'Server error' });
  }

};
const postGetFeedback = async (req, res) => {
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

};

const postGetVehicleReg = async (req, res) => {
  const { RegID } = req.body;
  const soapEnvelope = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://regcheck.org.uk">
        <soap:Header/>
        <soap:Body>
          <web:CheckIndia>
            <web:RegistrationNumber>${RegID}</web:RegistrationNumber>
            <web:username>Pratyay</web:username>
          </web:CheckIndia>
        </soap:Body>
      </soap:Envelope>
    `;

  try {
    const response = await fetch('https://www.regcheck.org.uk/api/reg.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://regcheck.org.uk/CheckIndia"'
      },
      body: soapEnvelope
    });

    const responseBody = await response.text();

    parseString(responseBody, { explicitArray: false }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        res.status(500).json({ error: 'Error parsing XML' });
        return;
      }
      try {
        console.log(result);
        const payload = result; // the parsed XML structure
        const vehicle_json_str = payload["soap:Envelope"]["soap:Body"]["CheckIndiaResponse"]["CheckIndiaResult"]["vehicleJson"];

        const vehicle_json = JSON.parse(vehicle_json_str);

        const vehicle_data = payload["soap:Envelope"]["soap:Body"]["CheckIndiaResponse"]["CheckIndiaResult"]["vehicleData"];
        const final_json = {
          Description: vehicle_data.Description,
          RegistrationYear: vehicle_data.RegistrationYear,
          CarMake: vehicle_data.CarMake.CurrentTextValue,
          CarModel: vehicle_data.CarModel,
          EngineSize: vehicle_data.EngineSize.CurrentTextValue
        };

        console.log(JSON.stringify(final_json, null, 4));
        res.status(200).json(final_json);
      } catch (error) {
        console.error('Error processing data:', error);
        res.status(500).json({ error: 'Error processing data' });
      }
    });

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Error fetching data' });
  }
};

module.exports = { getAllSubscriptions, postVehicle, putVehicleAdditional, uploadvehicleImages, postPricing, pauseCab, resumeCab, getVehicleAdditional, assignDriver, activateVehicle, postMonthlyData, postGetFeedback, postGetVehicleReg, getActiveSubscriptionForVehicle };