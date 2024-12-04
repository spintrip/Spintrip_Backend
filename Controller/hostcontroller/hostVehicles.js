const { Host, Car, User, Listing, HostAdditional, UserAdditional, Booking, Pricing, Brand, Feedback, carFeature, Feature, Blog, carDevices, Device, Transaction, Vehicle, Bike, VehicleAdditional, HostPayment } = require('../../Models');
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../../s3Config');
const path = require('path');
const uuid = require('uuid');
const { parseString } = require('xml2js');
const { npm } = require('winston/lib/winston/config');
const noImgPath = `https://spintrip-bucket.s3.ap-south-1.amazonaws.com/vehicleAdditional/no_image.webp`;


const vehicleImageStorage = multerS3({
  s3: s3,
  bucket: 'spintrip-bucket',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const vehicleid = req.body.vehicleid;
    const imageNumber = file.fieldname.split('_')[1];
    const fileName = `vehicleImage_${imageNumber}${path.extname(file.originalname)}`;
    cb(null, `vehicleAdditional/${vehicleid}/${fileName}`);
  }
});
const uploadvehicleImages = multer({ storage: vehicleImageStorage }).fields(
  Array.from({ length: 5 }, (_, i) => ({ name: `vehicleImage_${i + 1}` }))
);


async function deleteFromS3(key) {
  try {
    const params = {
      Bucket: 'spintrip-bucket',
      Key: key,
    };

    await s3.send(new DeleteObjectCommand(params));
    console.log(`Successfully deleted ${key}`);
  } catch (error) {
    console.error(`Error deleting ${key}`, error);
  }
}

const postVehicle = async (req, res) => {
  const { vehicletype } = req.body;

  try {
    // If it's a cab, delegate to addCab function from cabRoutes
    if (vehicletype === '3') {
      return addCab(req, res); // Pass request and response directly to addCab
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
    } = req.body;
    
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

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => value == "" || value == null)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      // Return a 400 error with the missing fields
      return res.status(400).json({
        message: 'Missing required fields',
        missingFields,
      });
    }
    const host = await Host.findByPk(req.user.id);

    if (!host) {
      return res.status(401).json({ message: 'Host not found' });
    }

    const vehicleId = uuid.v4();

    const vehicle = await Vehicle.create({
      vehicletype,
      chassisno: chassisNo || '0',
      Rcnumber: rcNumber,
      Enginenumber: engineNumber || '0',
      Registrationyear: registrationYear,
      vehicleid: vehicleId,
      hostId: req.user.id,
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

    await Pricing.create({
      vehicleid: vehicleId,
    });

    const listingId = uuid.v4();

    await Listing.create({
      id: listingId,
      vehicleid: vehicleId,
      hostid: req.user.id,
    });

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

    const updatedvehicleAdditional = await vehicleAdditional.update(updateData, { where: { vehicleid: vehicleid } });
    if (costperhr) {
      const Price = await Pricing.findOne({ where: { vehicleid: vehicleid } })
      if (Price) {
        await Price.update({ costperhr: costperhr });
      }
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
      await Additional.update({
        HorsePower: horsePower,
        AC: ac,
        FuelType: fuelType,
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
    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid, hostId: hostId } });
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found or unauthorized access' });
    }

    const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: vehicleid } });
    if (!vehicleAdditional) {
      return res.status(404).json({ message: 'Vehicle additional information not found' });
    }

    const safeBoolean = (value) => (value !== null && value !== undefined ? value : false);
    const checkImage = (value) => {
      return (value !== null && value !== undefined ? value : noImgPath) ;
    }

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
        bikeModel: bikeDetails?.bikemodel || "None",
        horsePower: bikeDetails?.HorsePower || "None",
        type: "Not Provided",
        brand: bikeDetails?.brand || "None",
        variant: bikeDetails?.variant || "None",
        color: bikeDetails?.color || "None",
        bodyType: "None",
      };

      // Populate booleanSpecs for bikes
      booleanSpecs = [
        { field_name: "fuelType", title: "Fuel Type", value: safeBoolean(bikeDetails?.FuelType), logo: "" },
        { field_name: "helmet", title: "Helmet", value: safeBoolean(bikeDetails?.helmet), logo: "" },
        { field_name: "helmetSpace", title: "Helmet Space", value: safeBoolean(bikeDetails?.helmetSpace), logo: "" },
      ];
    }


    if (vehicle.vehicletype == 2) {
      // Car-specific fields
      const carDetails = await Car.findOne({ where: { vehicleid: vehicleid } });
      additional = {
        carModel: carDetails?.carmodel || "None",
        horsePower: carDetails?.HorsePower || "None",
        type: "Not Provided",
        brand: carDetails?.brand || "None",
        variant: carDetails?.variant || "None",
        color: carDetails?.color || "None",
        bodyType: "None",
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
        { title: "Fuel Type", value: safeBoolean(carDetails?.FuelType), field_name: "fuelType", logo: "" },
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

    const vehicleAdditionals = {
      vehicleId: vehicle.vehicleid,
      vehicleType: vehicle.vehicletype,
      latitude: vehicleAdditional.latitude,
      longitude: vehicleAdditional.longitude,
      rcNumber: vehicle.Rcnumber,
      registrationYear: vehicle.Registrationyear,
    };
    const vehicleImages = [
      checkImage(vehicleAdditional.vehicleimage1),
      checkImage(vehicleAdditional.vehicleimage2),
      checkImage(vehicleAdditional.vehicleimage3),
      checkImage(vehicleAdditional.vehicleimage4),
      checkImage(vehicleAdditional.vehicleimage5)
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


const activateVehicle = async (req, res) => {
  const { vehicleid, paymentMethod, planType } = req.body;

  try {
    const host = await Host.findByPk(req.user.id);
    if (!host) {
      return res.status(401).json({ message: 'No Host found' });
    }

    const vehicle = await Vehicle.findOne({ where: { vehicleid, hostId: req.user.id } });
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    // Process payment (this is a placeholder, replace with actual payment processing logic)
    const paymentId = uuid.v4();
    const amount = 100; // Example amount, replace with actual amount
    await HostPayment.create({
      PaymentId: paymentId,
      HostId: req.user.id,
      VehicleId: vehicleid,
      PlanType: planType,
      PaymentDate: new Date(),
      PlanEndDate: new Date() + 1,
      Amount: amount,
      GSTAmount: amount * 0.18,
      TotalAmount: amount * 1.18,
      PaymentStatus: 1, // Assuming 1 means successful
      PaymentMethod: paymentMethod,
      Remarks: 'Vehicle activation payment'
    });

    await vehicle.update({ activated: true });

    res.status(200).json({ message: 'Vehicle activated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error activating vehicle' });
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

module.exports = { postVehicle, putVehicleAdditional, uploadvehicleImages, postPricing, getVehicleAdditional, activateVehicle, postMonthlyData, postGetFeedback, postGetVehicleReg };