const Razorpay = require('razorpay');
const { User, Vehicle, Chat, UserAdditional, Listing, sequelize, Booking, Pricing,
  carFeature, Feedback, Host, Tax, Wishlist, Feature, Blog, Bike, Car, Cab, HostAdditional, VehicleAdditional, BookingExtension, Transaction } = require('../../Models');
const { estimatePrice } = require('../cabController');
const { Op } = require('sequelize');
const moment = require('moment');
const path = require('path');
const csv = require('csv-parser');
const { checkData, checkStatus } = require('./userProfile');
const noVehicleImg = `https://spintrip-s3bucket.s3.ap-south-1.amazonaws.com/vehicleAdditional/no_image.png`;
const { Sequelize } = require('sequelize');
const BUFFER_MINUTES = 10;

const checkBool = (value) => {
  return value !== null && value !== undefined ? value : false;
}

const checkImage = (value) => {
  return value !== null && value !== undefined ? value : noVehicleImg;
}
const checkRating = (value) => {
  // Check if the value is a number and not null/undefined
  if (value !== null && value !== undefined && !isNaN(parseFloat(value))) {
    return parseFloat(value);
  }
  // Return 0.0 for any invalid rating
  return 0.0;
}


const fs = require('fs');
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Radius of the Earth in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in km
}

const validateBookingDates = (startDate, endDate, startTime, endTime) => {
  const startDateTime = moment(`${startDate} ${startTime}`, "YYYY-MM-DD HH:mm");
  const endDateTime = moment(`${endDate} ${endTime}`, "YYYY-MM-DD HH:mm");

  if (!startDateTime.isValid() || !endDateTime.isValid()) {
    return { isValid: false, error: "Invalid date or time format." };
  }

  if (!startDateTime.isBefore(endDateTime)) {
    return { isValid: false, error: "End time must be after start time." };
  }

  if (startDateTime.isBefore(moment())) {
    return { isValid: false, error: "Start date and time must be in the future." };
  }

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

const razorpay = new Razorpay({
  key_id: 'RAZORPAY_KEY_ID',
  key_secret: 'RAZORPAY_KEY_SECRET',
});


const getbrand = async (req, res) => {
  try {
    const brands = [];
    const csvFilePath = path.join(__dirname, '..', 'data', 'brands.csv');

    // Check if the file exists
    if (!fs.existsSync(csvFilePath)) {
      console.log(`File not found: ${csvFilePath}`);
      return res.status(404).json({ message: 'No brands found' });
    }
    console.log(`Reading file: ${csvFilePath}`);
    let brand;
    fs.createReadStream(csvFilePath)
      .pipe(csv({ headers: false }))
      .on('data', (row) => {
        if (row[1]) {
          brand = {
            brand_name: row[0],
            logo_path: row[1]
          };
        }
        else {
          brand = {
            brand_name: row[0],
            logo_path: null
          };

        }
        console.log(`Read row: ${JSON.stringify(brand)}`);
        brands.push(brand);
      })
      .on('end', () => {
        res.status(200).json({ brands });
      })
      .on('error', (error) => {
        console.error(`Error reading file: ${error}`);
        res.status(500).json({ message: 'Error reading CSV file', error });
      });
  } catch (error) {
    console.error(`Error in try-catch: ${error}`);
    res.status(500).json({ message: 'Error fetching brands', error });
  }
};
const features = async (req, res) => {

  try {
    const { vehicleid } = req.body;
    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid } });
    if (!vehicle) {
      return res.status(400).json({ message: 'vehicle is not available' });
    }
    const carFeatures = await carFeature.findAll({ where: { vehicleid }, include: [Feature] });
    if (!carFeatures || carFeatures.length === 0) {
      return res.status(400).json({ message: 'No vehicle Feature Available' });
    }
    res.status(201).json({ message: 'Feature with Price', carFeatures });
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching vehicle feature Details' });
  }
};

//Get All Vehicles
const getallVehicles = async (req, res) => {
  try {
    const vehiclesData = await Vehicle.findAll();
    let vehicles = vehiclesData.map(vehicle => ({
      vehicleid: checkData(vehicle.vehicleid),
      vehicletype: checkData(vehicle.vehicletype),
      chassisno: checkData(vehicle.chassisno),
      Rcnumber: checkData(vehicle.Rcnumber),
      Enginenumber: checkData(vehicle.Enginenumber),
      Registrationyear: checkData(vehicle.Registrationyear),
      timestamp: checkData(vehicle.timestamp),
      rating: vehicle.rating,
      activated: checkBool(vehicle.activated),
      hostId: checkData(vehicle.hostId),
      createdAt: checkData(vehicle.createdAt),
      updatedAt: checkData(vehicle.updatedAt)
    }));
    res.status(200).json(vehicles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching vehicles' });
  }
};

const findvehicles = async (req, res) => {
  const { vehicletype, startDate, endDate, startTime, endTime, latitude, longitude, distance, pickup, destination } = req.body;
  console.log(req.body);
  try {
    const dateValidation = validateBookingDates(startDate, endDate, startTime, endTime);
    if (!dateValidation.isValid) {
      return res.status(400).json({ message: dateValidation.error });
    }
    const availableListings = await Listing.findAll({
      where: {
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
      include: [{
        model: Vehicle,
        where: {
          vehicletype: vehicletype,
          activated: true,
        },
      },],
    });
    // Map over the listings to get cars with pricing
    const pricingPromises = availableListings.map(async (listing) => {
      // Extract vehicleid from listing dataValues
      const vehicleid = listing.dataValues.vehicleid;

      // Fetch the Car data based on vehicleid
      const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid } });

      let hostProfile = await HostAdditional.findOne({ where: { id: vehicle.hostId } });
      if (!vehicle) {
        // Skip or handle the error appropriately if Car data is not found
        return null;
      }
      const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: vehicleid } });
      if (!vehicleAdditional) {
        return null;
      }
      // if (carAdditional.verification_status != 2) {
      //   return null;
      // }
      const check_booking = await Booking.findOne({
        where: {
          vehicleid: vehicleid,
          status: {
            [Op.in]: [1, 2, 5]
          },
          [Op.or]: [
            // Case 1: The existing booking starts during the requested period
            {
              [Op.and]: [
                { startTripDate: { [Op.eq]: startDate } },
                { startTripTime: { [Op.between]: [startTime, endTime] } }
              ]
            },
            // Case 2: The existing booking ends during the requested period
            {
              [Op.and]: [
                { endTripDate: { [Op.eq]: endDate } },
                { endTripTime: { [Op.between]: [startTime, endTime] } }
              ]
            },
            // Case 3: The existing booking starts before the requested period and ends after it starts
            {
              [Op.and]: [
                { startTripDate: { [Op.lte]: startDate } },
                { endTripDate: { [Op.gte]: startDate } },
                {
                  [Op.or]: [
                    {
                      [Op.and]: [
                        { startTripDate: { [Op.eq]: startDate } },
                        { startTripTime: { [Op.lte]: startTime } }
                      ]
                    },
                    {
                      [Op.and]: [
                        { endTripDate: { [Op.eq]: startDate } },
                        { endTripTime: { [Op.gte]: startTime } }
                      ]
                    }
                  ]
                }
              ]
            },
            // Case 4: The requested period starts during an existing booking
            {
              [Op.and]: [
                { startTripDate: { [Op.lte]: endDate } },
                { endTripDate: { [Op.gte]: startDate } },
                {
                  [Op.or]: [
                    {
                      [Op.and]: [
                        { startTripDate: { [Op.eq]: endDate } },
                        { startTripTime: { [Op.lte]: endTime } }
                      ]
                    },
                    {
                      [Op.and]: [
                        { endTripDate: { [Op.eq]: startDate } },
                        { endTripTime: { [Op.gte]: startTime } }
                      ]
                    }
                  ]
                }
              ]
            },
            // Case 5: The existing booking completely overlaps the requested period
            {
              [Op.and]: [
                { startTripDate: { [Op.lte]: startDate } },
                { endTripDate: { [Op.gte]: endDate } },
                {
                  [Op.or]: [
                    {
                      [Op.and]: [
                        { startTripDate: { [Op.eq]: startDate } },
                        { startTripTime: { [Op.lte]: startTime } }
                      ]
                    },
                    {
                      [Op.and]: [
                        { endTripDate: { [Op.eq]: endDate } },
                        { endTripTime: { [Op.gte]: endTime } }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              [Op.and]: [
                { startTripDate: { [Op.lt]: startDate } },
                { endTripDate: { [Op.gt]: startDate } },
                { endTripDate: { [Op.lt]: endDate } }
              ]
            },
            {
              [Op.and]: [
                { startTripDate: { [Op.gte]: startDate } },
                { endTripDate: { [Op.lte]: endDate } },
              ],
            },
            {
              [Op.and]: [
                { startTripDate: { [Op.lt]: startDate } },
                { endTripDate: { [Op.gt]: endDate } }
              ]
            }
          ]
        }
      });
      if (check_booking) {
        return null;
      }

      let Additional, additionalData;
      let booleanSpecs = [];
      let vehicleModel;
      if (vehicle.vehicletype == 1) {
        additionalData = await Bike.findOne({ where: { vehicleid: vehicleid } });
        vehicleModel = additionalData.bikemodel;
        Additional = {
          bikemodel: checkData(additionalData.bikemodel),
          HorsePower: checkData(additionalData.HorsePower),
          type: checkData(additionalData.type),
          brand: checkData(additionalData.brand),
          variant: checkData(additionalData.variant),
          color: checkData(additionalData.color),
          bodytype: checkData(additionalData.bodytype),
          FuelType: checkBool(additionalData.FuelType),
          helmet: checkBool(additionalData.helmet),
          helmetSpace: checkBool(additionalData.helmetSpace),
          vehicleid: checkData(additionalData.vehicleid),
          timestamp: checkData(additionalData.timestamp),
          city: checkData(additionalData.city),
          buisnessName: checkData(hostProfile?.businessName),
          hostId: checkData(additionalData.hostId),
          createdAt: checkData(additionalData.createdAt),
          updatedAt: checkData(additionalData.updatedAt)
        }
        console.log(additionalData.helmet);
        console.log(additionalData.helmetSpace);
        booleanSpecs = [
          // { field_name: "fuelType", title: "Fuel Type", value: checkBool(additionalData.FuelType), logo: "" },
          { field_name: "helmet", title: "Helmet", value: checkBool(additionalData.helmet), logo: "" },
          { field_name: "helmetSpace", title: "Helmet Space", value: checkBool(additionalData.helmetSpace), logo: "" },
        ];
      }
      if (vehicle.vehicletype == 2) {
        additionalData = await Car.findOne({ where: { vehicleid: vehicleid } });
        vehicleModel = additionalData.carmodel;
        Additional = {
          carmodel: checkData(additionalData.carmodel),
          HorsePower: checkData(additionalData.HorsePower),
          type: checkData(additionalData.type),
          brand: checkData(additionalData.brand),
          variant: checkData(additionalData.variant),
          color: checkData(additionalData.color),
          bodytype: checkData(additionalData.bodytype),
          AC: checkBool(additionalData.AC),
          Musicsystem: checkBool(additionalData.Musicsystem),
          Autowindow: checkBool(additionalData.Autowindow),
          Sunroof: checkBool(additionalData.Sunroof),
          Touchscreen: checkBool(additionalData.Touchscreen),
          Sevenseater: checkBool(additionalData.Sevenseater),
          Reversecamera: checkBool(additionalData.Reversecamera),
          Transmission: checkBool(additionalData.Transmission),
          Airbags: checkBool(additionalData.Airbags),
          FuelType: checkBool(additionalData.FuelType),
          PetFriendly: checkBool(additionalData.PetFriendly),
          PowerSteering: checkBool(additionalData.PowerSteering),
          ABS: checkBool(additionalData.ABS),
          tractionControl: checkBool(additionalData.tractionControl),
          fullBootSpace: checkBool(additionalData.fullBootSpace),
          KeylessEntry: checkBool(additionalData.KeylessEntry),
          airPurifier: checkBool(additionalData.airPurifier),
          cruiseControl: checkBool(additionalData.cruiseControl),
          voiceControl: checkBool(additionalData.voiceControl),
          usbCharger: checkBool(additionalData.usbCharger),
          bluetooth: checkBool(additionalData.bluetooth),
          airFreshner: checkBool(additionalData.airFreshner),
          ventelatedFrontSeat: checkBool(additionalData.ventelatedFrontSeat),
          vehicleid: checkData(additionalData.vehicleid),
          timestamp: checkData(additionalData.timestamp),
          rating: checkData(additionalData.rating),
          city: checkData(additionalData.city),
          buisnessName: checkData(hostProfile?.businessName),
          hostId: checkData(additionalData.hostId),
          createdAt: checkData(additionalData.createdAt),
          updatedAt: checkData(additionalData.updatedAt)
        }

        booleanSpecs = [
          { title: "Air Conditioning", value: checkBool(additionalData.AC), field_name: "ac", logo: "" },
          { title: "Music System", value: checkBool(additionalData.Musicsystem), field_name: "musicSystem", logo: "" },
          { title: "Auto Window", value: checkBool(additionalData.Autowindow), field_name: "autoWindow", logo: "" },
          { title: "Sunroof", value: checkBool(additionalData.Sunroof), field_name: "sunroof", logo: "" },
          { title: "Touchscreen", value: checkBool(additionalData.Touchscreen), field_name: "touchscreen", logo: "" },
          { title: "Seven Seater", value: checkBool(additionalData.Sevenseater), field_name: "sevenSeater", logo: "" },
          { title: "Reverse Camera", value: checkBool(additionalData.Reversecamera), field_name: "reverseCamera", logo: "" },
          { title: "Transmission", value: checkBool(additionalData.Transmission), field_name: "transmission", logo: "" },
          { title: "Airbags", value: checkBool(additionalData.Airbags), field_name: "airbags", logo: "" },
          { title: "Fuel Type", value: checkBool(additionalData.FuelType), field_name: "fuelType", logo: "" },
          { title: "Pet Friendly", value: checkBool(additionalData.PetFriendly), field_name: "petFriendly", logo: "" },
          { title: "Power Steering", value: checkBool(additionalData.PowerSteering), field_name: "powerSteering", logo: "" },
          { title: "ABS", value: checkBool(additionalData.ABS), field_name: "abs", logo: "" },
          { title: "Traction Control", value: checkBool(additionalData.tractionControl), field_name: "tractionControl", logo: "" },
          { title: "Full Boot Space", value: checkBool(additionalData.fullBootSpace), field_name: "fullBootSpace", logo: "" },
          { title: "Keyless Entry", value: checkBool(additionalData.KeylessEntry), field_name: "keylessEntry", logo: "" },
          { title: "Air Purifier", value: checkBool(additionalData.airPurifier), field_name: "airPurifier", logo: "" },
          { title: "Cruise Control", value: checkBool(additionalData.cruiseControl), field_name: "cruiseControl", logo: "" },
          { title: "Voice Control", value: checkBool(additionalData.voiceControl), field_name: "voiceControl", logo: "" },
          { title: "USB Charger", value: checkBool(additionalData.usbCharger), field_name: "usbCharger", logo: "" },
          { title: "Bluetooth", value: checkBool(additionalData.bluetooth), field_name: "bluetooth", logo: "" },
          { title: "Air Freshener", value: checkBool(additionalData.airFreshner), field_name: "airFreshener", logo: "" },
          { title: "Ventilated Front Seat", value: checkBool(additionalData.ventelatedFrontSeat), field_name: "ventilatedFrontSeat", logo: "" }
        ];
      }



      // Fetch the Pricing data for the Car
      const cph = await Pricing.findOne({ where: { vehicleid: vehicleid } });
      let availableVehicle = {
        vehicleid: checkData(vehicle.vehicleid),
        vehicleModel: vehicleModel,
        chassisNo: checkData(vehicle.chassisno),
        rcNumber: checkData(vehicle.Rcnumber),
        hostId: checkData(vehicle.hostId),
        rating: checkData(vehicle.rating),
        // buisnessName: checkData(vehicleAdditional.buisnessname),
        registrationYear: checkData(vehicle.Registrationyear),
        additionalInfo: checkData(vehicleAdditional.Additionalinfo),
        latitude: checkData(vehicleAdditional.latitude),
        longitude: checkData(vehicleAdditional.longitude),
        vehicleImage1: checkImage(vehicleAdditional.vehicleimage1),
        vehicleImage2: checkImage(vehicleAdditional.vehicleimage2),
        vehicleImage3: checkImage(vehicleAdditional.vehicleimage3),
        vehicleImage4: checkImage(vehicleAdditional.vehicleimage4),
        vehicleImage5: checkImage(vehicleAdditional.vehicleimage5),
        booleanSpecs,
      }
      let amount = 0;
      let hours = 0;
      let costperhr = 0;
      let estimatedamount;
      if (cph) {
        hours = calculateTripHours(startDate, endDate, startTime, endTime);
        amount = Math.round(cph.costperhr * hours);
        costperhr = Math.round(cph.costperhr);

        // Combine the Car data with the pricing information
        return { ...availableVehicle, pricing: { costPerHr: costperhr, costperhr: costperhr, hours: hours, amount: amount }, Additional };
      } else {
        // Handle the case where Pricing data is not available
        return { ...availableVehicle, pricing: 0, Additional };
      }
    });
    let vehicleWithPricing = (await Promise.all(pricingPromises)).filter(vehicle => vehicle !== null);

    if (latitude && longitude) {
      vehicleWithPricing.forEach(vehicle => {
        vehicle.distance = haversineDistance(latitude, longitude, vehicle.latitude, vehicle.longitude);
      });

      vehicleWithPricing = vehicleWithPricing
        .filter(vehicle => vehicle.distance <= distance)
        .sort((a, b) => a.distance - b.distance);
    }
    res.status(200).json({ availableVehicles: vehicleWithPricing });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error finding available vehicles' });
  }
}

const findCabs = async (req, res) => {

  try {

    const { pickup, destination, cabType } = req.body;

    const pickupLat = pickup?.latitude;
    const pickupLng = pickup?.longitude;

    const destLat = destination?.latitude;
    const destLng = destination?.longitude;

    if (!pickupLat || !pickupLng || !destLat || !destLng) {
      return res.status(400).json({ message: "Invalid pickup or destination coordinates." });
    }

    /// fetch activated cab vehicles
    let vehicles = await Vehicle.findAll({

      where: {
        vehicletype: '3',
        activated: true
      },

      include: [
        { model: Cab },
        { model: VehicleAdditional },
        { model: Pricing },
        { model: HostAdditional }
      ]

    });

    let availableVehicles = [];

    for (const v of vehicles) {

      const cab = v.Cab;
      const additional = v.VehicleAdditional;
      const price = v.Pricing;
      const host = v.HostAdditional;

      if (!cab || !additional || !price) continue;
      console.log(`Checking vehicle ${v.vehicleid} - Cab: ${cab.type}, Service Type: ${cab.serviceType}, Location: (${additional.latitude}, ${additional.longitude})`);
      /// cabType filter
      if (cabType === "airport" &&  cab.serviceType !== "Airport" ) continue;

      if (cabType === "outstation" && cab.serviceType !== "Outstation") continue;

      if (cabType === "local" && cab.serviceType !== "Local") continue;

      /// distance calculation
      const distance = haversineDistance(
        pickupLat,
        pickupLng,
        additional.latitude,
        additional.longitude
      );

      /// optional radius filter
      if (distance > 50) continue;

      /// booking check
      const booking = await Booking.findOne({

        where: {
          vehicleid: v.vehicleid,
          status: { [Op.in]: [1, 2, 5] }
        }

      });

      if (booking) continue;

      availableVehicles.push({

        vehicleid: v.vehicleid,
        rentalName: host?.businessName || "Rental",
        cabType: cab.type,

        vehicleImage1: additional.vehicleimage1 || noVehicleImg,
        vehicleImage2: additional.vehicleimage2 || noVehicleImg,
        vehicleImage3: additional.vehicleimage3 || noVehicleImg,
        vehicleImage4: additional.vehicleimage4 || noVehicleImg,
        vehicleImage5: additional.vehicleimage5 || noVehicleImg,

        basePrice: price.priceperkm || price.fixedPrice || 0,

        latitude: additional.latitude,
        longitude: additional.longitude,

        distance

      });

    }

    /// group by rental
    const grouped = {};

    for (const v of availableVehicles) {

      if (!grouped[v.rentalName]) {

        grouped[v.rentalName] = {
          rentalName: v.rentalName,
          distance: v.distance,
          cabs: {}
        };

      }

      if (!grouped[v.rentalName].cabs[v.cabType]) {

        grouped[v.rentalName].cabs[v.cabType] = {
          count: 1,
          vehicleid: v.vehicleid,
          basePrice: v.basePrice,
          images: [
            v.vehicleImage1,
            v.vehicleImage2,
            v.vehicleImage3,
            v.vehicleImage4,
            v.vehicleImage5
          ]
        };

      } else {

        grouped[v.rentalName].cabs[v.cabType].count++;

        /// keep cheapest vehicle
        if (v.basePrice < grouped[v.rentalName].cabs[v.cabType].basePrice) {

          grouped[v.rentalName].cabs[v.cabType].basePrice = v.basePrice;
          grouped[v.rentalName].cabs[v.cabType].vehicleid = v.vehicleid;

        }

      }

    }

    /// estimate price only for cheapest vehicle
    for (const rental of Object.values(grouped)) {

      for (const type in rental.cabs) {

        const vehicleId = rental.cabs[type].vehicleid;

        try {

          const estimate = await estimatePrice({

            origin: `${pickupLat},${pickupLng}`,
            destination: `${destLat},${destLng}`,
            vehicleId

          });

          rental.cabs[type].price = estimate.estimatedPrice;

        } catch (err) {

          console.log("Error estimating price:", err.message);

          rental.cabs[type].price = rental.cabs[type].basePrice;

        }

        delete rental.cabs[type].basePrice;

      }

    }

    /// convert to array
    const rentals = Object.values(grouped);

    /// sort by nearest rental
    rentals.sort((a, b) => a.distance - b.distance);

    res.status(200).json({ rentals });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Error fetching cab listings"
    });

  }

};
const findCabs1 = async (req, res) => {
  const {
    pickup,
    destination,
    startDate,
    startTime,
    latitude,
    longitude,
    distance = 70   // km radius
  } = req.body;

  try {
    /* ---------------------------
       0. Validation
    ----------------------------*/
    if (!pickup || !destination || !startDate || !startTime) {
      return res.status(400).json({
        message: 'pickup, destination, startDate and startTime are required'
      });
    }

    /* ---------------------------
       1. Build pickup datetime
    ----------------------------*/
    const pickupDateTime = new Date(`${startDate}T${startTime}+05:30`); // IST

    if (isNaN(pickupDateTime.getTime())) {
      return res.status(400).json({
        message: 'Invalid startDate or startTime format'
      });
    }

    /* ---------------------------
       2. Fetch active cab vehicles
    ----------------------------*/
    const cabs = await Vehicle.findAll({
      where: {
        vehicletype: "3",   // cab (STRING because DB type is STRING)
        activated: true
      },
      include: [
        {
          model: Cab,
          required: true
        },
        {
          model: VehicleAdditional,
          required: true
        }
      ]
    });

    if (!cabs.length) {
      return res.status(200).json({
        availableCabs: [],
        message: 'No cabs available'
      });
    }

    /* ---------------------------
       3. Filter available cabs
    ----------------------------*/
    const cabResults = [];


    for (const cabVehicle of cabs) {
      const vehicleid = cabVehicle.vehicleid;

      /* ---------------------------
         Price estimation (PER CAB ✅)
      ----------------------------*/
      let routeEstimate;
      try {
        routeEstimate = await estimatePrice({
          origin: pickup,
          destination,
          vehicleId: vehicleid   // ✅ REQUIRED PARAM
        });
      } catch (e) {
        console.error('Price estimation failed for vehicle:', vehicleid, e.message);
        continue; // skip this cab if pricing fails
      }

      const tripDurationMin = routeEstimate?.duration || 30;
      const tripDistanceKm = routeEstimate?.distance || 10;
      const estimatedAmount = routeEstimate?.estimatedPrice || 0;

      const tripEndDateTime = new Date(
        pickupDateTime.getTime() + (tripDurationMin + BUFFER_MINUTES) * 60000
      );

      /* ---------------------------
         Booking overlap check
      ----------------------------*/
      const activeBooking = await Booking.findOne({
        where: {
          vehicleid,
          status: { [Op.in]: [1, 2, 5] }, // active statuses
          [Op.and]: Sequelize.literal(`
  (
    ("startTripDate" + "startTripTime") <= '${tripEndDateTime.toISOString()}'
    AND
    ("endTripDate" + "endTripTime") >= '${pickupDateTime.toISOString()}'
  )
`)

        }
      });

      if (activeBooking) continue;

      /* ---------------------------
         Build response object
      ----------------------------*/
      const cabData = cabVehicle.Cab;
      const vehicleAdditional = cabVehicle.VehicleAdditional;
      const hostProfile = await HostAdditional.findOne({
        where: { id: cabVehicle.hostId }
      });
      const vehicleImages = [
        checkImage(vehicleAdditional.vehicleimage1),
        checkImage(vehicleAdditional.vehicleimage2),
        checkImage(vehicleAdditional.vehicleimage3),
        checkImage(vehicleAdditional.vehicleimage4),
        checkImage(vehicleAdditional.vehicleimage5)
      ];

      let cabObj = {
        vehicleid: cabVehicle.vehicleid,
        vehicleModel: cabData.model,
        brand: cabData.brand,
        type: cabData.type,
        variant: cabData.variant,
        color: cabData.color,

        hostId: cabVehicle.hostId,
        businessName: hostProfile?.businessName || null,

        latitude: vehicleAdditional.latitude,
        longitude: vehicleAdditional.longitude,

        vehicleImage1: checkImage(vehicleAdditional.vehicleimage1),
        vehicleImage2: checkImage(vehicleAdditional.vehicleimage2),
        vehicleImage3: checkImage(vehicleAdditional.vehicleimage3),
        vehicleImage4: checkImage(vehicleAdditional.vehicleimage4),
        vehicleImage5: checkImage(vehicleAdditional.vehicleimage5),
        pricing: {
          pricingType: "cab",
          estimatedAmount: Math.round(estimatedAmount),
          distanceKm: tripDistanceKm,
          durationMin: tripDurationMin,
          baseFare: routeEstimate?.baseFare || 0,
          perKmRate: routeEstimate?.perKmRate || 0,
          perMinRate: routeEstimate?.perMinRate || 0,
          surgeMultiplier: 1.0
        },

        route: {
          pickup,
          destination
        }
      };

      /* ---------------------------
         Distance filter
      ----------------------------*/
      if (latitude && longitude) {
        cabObj.distance = haversineDistance(
          latitude,
          longitude,
          cabObj.latitude,
          cabObj.longitude
        );

        if (cabObj.distance > distance) continue;
      }

      cabResults.push(cabObj);
    }

    /* ---------------------------
       Sort by nearest cab
    ----------------------------*/
    if (latitude && longitude) {
      cabResults.sort((a, b) => a.distance - b.distance);
    }

    /* ---------------------------
       Final Response
    ----------------------------*/
    return res.status(200).json({
      availableCabs: cabResults,
      routeInfo: {
        pickup,
        destination,
        distanceKm: cabResults[0]?.pricing?.distanceKm || null,
        durationMin: cabResults[0]?.pricing?.durationMin || null,
        pickupDateTime,
        tripEndDateTime: cabResults[0] ? new Date(
          pickupDateTime.getTime() +
          (cabResults[0].pricing.durationMin + BUFFER_MINUTES) * 60000
        ) : null
      }
    });

  } catch (error) {
    console.error('CAB SEARCH ERROR:', error);
    return res.status(500).json({
      message: 'Error finding available cabs',
      error: error.message
    });
  }
};

const onevehicle = async (req, res) => {
  const { vehicleid, startDate, endDate, startTime, endTime, features } = req.body;
  try {
    const dateValidation = validateBookingDates(startDate, endDate, startTime, endTime);
    if (!dateValidation.isValid) {
      return res.status(400).json({ message: dateValidation.error });
    }
    const availableListings = await Listing.findOne({
      where: {
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
        vehicleid: vehicleid,
      },
      include: [Vehicle],
    });
    if (availableListings) {
      // Extract car information from the listings
      const availableVehicles = await Vehicle.findOne({
        where: {
          vehicleid: availableListings.vehicleid,
        }
      });
      const check_booking = await Booking.findOne({
        where: {
          vehicleid: vehicleid,
          status: {
            [Op.in]: [1, 2, 5]  // Assuming 1 and 2 are statuses for active bookings
          },
          [Op.or]: [
            // Case 1: The existing booking starts during the requested period
            {
              [Op.and]: [
                { startTripDate: { [Op.eq]: startDate } },
                { startTripTime: { [Op.between]: [startTime, endTime] } }
              ]
            },
            // Case 2: The existing booking ends during the requested period
            {
              [Op.and]: [
                { endTripDate: { [Op.eq]: endDate } },
                { endTripTime: { [Op.between]: [startTime, endTime] } }
              ]
            },
            // Case 3: The existing booking starts before the requested period and ends after it starts
            {
              [Op.and]: [
                { startTripDate: { [Op.lte]: startDate } },
                { endTripDate: { [Op.gte]: startDate } },
                {
                  [Op.or]: [
                    {
                      [Op.and]: [
                        { startTripDate: { [Op.eq]: startDate } },
                        { startTripTime: { [Op.lte]: startTime } }
                      ]
                    },
                    {
                      [Op.and]: [
                        { endTripDate: { [Op.eq]: startDate } },
                        { endTripTime: { [Op.gte]: startTime } }
                      ]
                    }
                  ]
                }
              ]
            },
            // Case 4: The requested period starts during an existing booking
            {
              [Op.and]: [
                { startTripDate: { [Op.lte]: endDate } },
                { endTripDate: { [Op.gte]: startDate } },
                {
                  [Op.or]: [
                    {
                      [Op.and]: [
                        { startTripDate: { [Op.eq]: endDate } },
                        { startTripTime: { [Op.lte]: endTime } }
                      ]
                    },
                    {
                      [Op.and]: [
                        { endTripDate: { [Op.eq]: startDate } },
                        { endTripTime: { [Op.gte]: startTime } }
                      ]
                    }
                  ]
                }
              ]
            },
            // Case 5: The existing booking completely overlaps the requested period
            {
              [Op.and]: [
                { startTripDate: { [Op.lte]: startDate } },
                { endTripDate: { [Op.gte]: endDate } },
                {
                  [Op.or]: [
                    {
                      [Op.and]: [
                        { startTripDate: { [Op.eq]: startDate } },
                        { startTripTime: { [Op.lte]: startTime } }
                      ]
                    },
                    {
                      [Op.and]: [
                        { endTripDate: { [Op.eq]: endDate } },
                        { endTripTime: { [Op.gte]: endTime } }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              [Op.and]: [
                { startTripDate: { [Op.lt]: startDate } },
                { endTripDate: { [Op.gt]: startDate } },
                { endTripDate: { [Op.lt]: endDate } }
              ]
            },
            {
              [Op.and]: [
                { startTripDate: { [Op.gte]: startDate } },
                { endTripDate: { [Op.lte]: endDate } },
              ],
            },
            {
              [Op.and]: [
                { startTripDate: { [Op.lt]: startDate } },
                { endTripDate: { [Op.gt]: endDate } }
              ]
            },
          ]
        }
      });
      if (check_booking) {
        return res.status(400).json({ message: 'Selected vehicle is not available for the specified dates' });
      }
      // Calculate pricing for each available car
      const cph = await Pricing.findOne({ where: { vehicleid: availableVehicles.vehicleid } });
      let vehicles = {
        vehicleid: checkData(availableVehicles.vehicleid),
        chassisNo: checkData(availableVehicles.chassisno),
        rcNumber: checkData(availableVehicles.Rcnumber),
        hostId: checkData(availableVehicles.hostId),
        rating: checkData(availableVehicles.rating),

      }
      let hostProfile = await HostAdditional.findOne({ where: { id: availableVehicles.hostId } });
      let Additional, additionalData;
      if (availableVehicles.vehicletype == 1) {
        additionalData = await Bike.findOne({ where: { vehicleid: vehicleid } });
        Additional = {
          bikemodel: checkData(additionalData.bikemodel),
          HorsePower: checkData(additionalData.HorsePower),
          type: checkData(additionalData.type),
          brand: checkData(additionalData.brand),
          variant: checkData(additionalData.variant),
          color: checkData(additionalData.color),
          bodytype: checkData(additionalData.bodytype),
          FuelType: checkBool(additionalData.FuelType),
          helmet: checkBool(additionalData.helmet),
          helmetSpace: checkBool(additionalData.helmetSpace),
          vehicleid: checkData(additionalData.vehicleid),
          timestamp: checkData(additionalData.timestamp),
          city: checkData(additionalData.city),
          buisnessName: checkData(hostProfile ? hostProfile.buisnessname : null),
          hostId: checkData(additionalData.hostId),
          createdAt: checkData(additionalData.createdAt),
          updatedAt: checkData(additionalData.updatedAt)
        }
      }
      if (availableVehicles.vehicletype == 2) {
        additionalData = await Car.findOne({ where: { vehicleid: vehicleid } });
        Additional = {
          carmodel: checkData(additionalData.carmodel),
          HorsePower: checkData(additionalData.HorsePower),
          type: checkData(additionalData.type),
          brand: checkData(additionalData.brand),
          variant: checkData(additionalData.variant),
          color: checkData(additionalData.color),
          bodytype: checkData(additionalData.bodytype),
          AC: checkBool(additionalData.AC),
          Musicsystem: checkBool(additionalData.Musicsystem),
          Autowindow: checkBool(additionalData.Autowindow),
          Sunroof: checkBool(additionalData.Sunroof),
          Touchscreen: checkBool(additionalData.Touchscreen),
          Sevenseater: checkBool(additionalData.Sevenseater),
          Reversecamera: checkBool(additionalData.Reversecamera),
          Transmission: checkBool(additionalData.Transmission),
          Airbags: checkBool(additionalData.Airbags),
          FuelType: checkBool(additionalData.FuelType),
          PetFriendly: checkBool(additionalData.PetFriendly),
          PowerSteering: checkBool(additionalData.PowerSteering),
          ABS: checkBool(additionalData.ABS),
          tractionControl: checkBool(additionalData.tractionControl),
          fullBootSpace: checkBool(additionalData.fullBootSpace),
          KeylessEntry: checkBool(additionalData.KeylessEntry),
          airPurifier: checkBool(additionalData.airPurifier),
          cruiseControl: checkBool(additionalData.cruiseControl),
          voiceControl: checkBool(additionalData.voiceControl),
          usbCharger: checkBool(additionalData.usbCharger),
          bluetooth: checkBool(additionalData.bluetooth),
          airFreshner: checkBool(additionalData.airFreshner),
          ventelatedFrontSeat: checkBool(additionalData.ventelatedFrontSeat),
          vehicleid: checkData(additionalData.vehicleid),
          timestamp: checkData(additionalData.timestamp),
          rating: checkData(additionalData.rating),
          city: checkData(additionalData.city),
          buisnessName: checkData(hostProfile.buisnessname),
          hostId: checkData(additionalData.hostId),
          createdAt: checkData(additionalData.createdAt),
          updatedAt: checkData(additionalData.updatedAt)
        }
      }
      if (availableVehicles.vehicletype == 3) {
        additionalData = await Cab.findOne({ where: { vehicleid: vehicleid } });
        Additional = {
          cabmodel: checkData(additionalData.model),
          // HorsePower: checkData(additionalData.HorsePower),
          type: checkData(additionalData.type),
          brand: checkData(additionalData.brand),
          variant: checkData(additionalData.variant),
          color: checkData(additionalData.color),
          vehicleid: checkData(additionalData.vehicleid),
          timestamp: checkData(additionalData.timestamp),
          rating: checkData(additionalData.rating),
          city: checkData(additionalData.city),
          hostId: checkData(additionalData.hostId),
          buisnessName: checkData(hostProfile.buisnessname),
          createdAt: checkData(additionalData.createdAt),
          updatedAt: checkData(additionalData.updatedAt)
        }
      }
      if (cph) {
        const hours = calculateTripHours(startDate, endDate, startTime, endTime);
        let amount = Math.round(cph.costperhr * hours);
        const costperhr = cph.costperhr;
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
        // Include pricing information in the car object
        res.status(200).json({ vehicles, Additional, pricing: { costPerHr: costperhr, hours: hours, amount: amount } });
      } else {
        res.status(200).json({ vehicles, Additional, pricing: 0 });
      }
    }
    else {
      res.status(400).json({ message: 'vehicle is not available' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error finding available vehicle' });
  }
}


const getvehicleadditional = async (req, res) => {
  const { vehicleid } = req.body;

  try {
    // Check if the host owns the vehicle
    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid } });
    if (!vehicle) {
      return res.status(404).json({ message: 'vehicle not found or unauthorized access' });
    }
    const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: vehicleid } });
    if (!vehicleAdditional) {
      return res.status(404).json({ message: 'vehicle additional information not found' });
    }
    let Additional, additionalData, vehicleAdditionals;
    if (vehicle.vehicletype == 1) {
      additionalData = await Bike.findOne({ where: { vehicleid: vehicleid } });
      Additional = {
        bikemodel: checkData(additionalData.bikemodel),
        HorsePower: checkData(additionalData.HorsePower),
        type: checkData(additionalData.type),
        brand: checkData(additionalData.brand),
        variant: checkData(additionalData.variant),
        color: checkData(additionalData.color),
        bodytype: checkData(additionalData.bodytype),
        FuelType: checkBool(additionalData.FuelType),
        helmet: checkBool(additionalData.helmet),
        helmetSpace: checkBool(additionalData.helmetSpace),
        vehicleid: checkData(additionalData.vehicleid),
        timestamp: checkData(additionalData.timestamp),
        city: checkData(additionalData.city),
        hostId: checkData(additionalData.hostId),
        createdAt: checkData(additionalData.createdAt),
        updatedAt: checkData(additionalData.updatedAt)
      }

    }
    if (vehicle.vehicletype == 2) {
      additionalData = await Car.findOne({ where: { vehicleid: vehicleid } });
      Additional = {
        carmodel: checkData(additionalData.carmodel),
        HorsePower: checkData(additionalData.HorsePower),
        type: checkData(additionalData.type),
        brand: checkData(additionalData.brand),
        variant: checkData(additionalData.variant),
        color: checkData(additionalData.color),
        bodytype: checkData(additionalData.bodytype),
        AC: checkBool(additionalData.AC),
        Musicsystem: checkBool(additionalData.Musicsystem),
        Autowindow: checkBool(additionalData.Autowindow),
        Sunroof: checkBool(additionalData.Sunroof),
        Touchscreen: checkBool(additionalData.Touchscreen),
        Sevenseater: checkBool(additionalData.Sevenseater),
        Reversecamera: checkBool(additionalData.Reversecamera),
        Transmission: checkBool(additionalData.Transmission),
        Airbags: checkBool(additionalData.Airbags),
        FuelType: checkBool(additionalData.FuelType),
        PetFriendly: checkBool(additionalData.PetFriendly),
        PowerSteering: checkBool(additionalData.PowerSteering),
        ABS: checkBool(additionalData.ABS),
        tractionControl: checkBool(additionalData.tractionControl),
        fullBootSpace: checkBool(additionalData.fullBootSpace),
        KeylessEntry: checkBool(additionalData.KeylessEntry),
        airPurifier: checkBool(additionalData.airPurifier),
        cruiseControl: checkBool(additionalData.cruiseControl),
        voiceControl: checkBool(additionalData.voiceControl),
        usbCharger: checkBool(additionalData.usbCharger),
        bluetooth: checkBool(additionalData.bluetooth),
        airFreshner: checkBool(additionalData.airFreshner),
        ventelatedFrontSeat: checkBool(additionalData.ventelatedFrontSeat),
        vehicleid: checkData(additionalData.vehicleid),
        timestamp: checkData(additionalData.timestamp),
        rating: checkData(additionalData.rating),
        city: checkData(additionalData.city),
        hostId: checkData(additionalData.hostId),
        createdAt: checkData(additionalData.createdAt),
        updatedAt: checkData(additionalData.updatedAt)
      }
    }
    if (vehicle.vehicletype == 3) {
      additionalData = await Cab.findOne({ where: { vehicleid: vehicleid } });
      Additional = {
        cabmodel: checkData(additionalData.model),
        type: checkData(additionalData.type),
        brand: checkData(additionalData.brand),
        variant: checkData(additionalData.variant),
        color: checkData(additionalData.color),
        vehicleid: checkData(additionalData.vehicleid),
        timestamp: checkData(additionalData.timestamp),
        rating: checkData(additionalData.rating),
        city: checkData(additionalData.city),
        hostId: checkData(additionalData.hostId),
        createdAt: checkData(additionalData.createdAt),
        updatedAt: checkData(additionalData.updatedAt)
      }
    }
    const features = await carFeature.findAll({ where: { vehicleid: vehicleid } });
    const featureList = await Feature.findAll();
    const featureMap = featureList.reduce((map, f) => (map[f.id] = f.featureName, map), {});

    const updatedFeatures = features.map(f => ({
      ...f.dataValues,
      featureName: featureMap[f.featureid]
    }));


    vehicleAdditionals = {
      vehicleid: vehicle.vehicleid,
      vehicleImage1: checkImage(vehicleAdditional.vehicleimage1),
      vehicleImage2: checkImage(vehicleAdditional.vehicleimage2),
      vehicleImage3: checkImage(vehicleAdditional.vehicleimage3),
      vehicleImage4: checkImage(vehicleAdditional.vehicleimage4),
      vehicleImage5: checkImage(vehicleAdditional.vehicleimage5),
      verificationStatus: checkStatus(vehicleAdditional.verification_status),
      latitude: checkData(vehicleAdditional.latitude),
      longitude: checkData(vehicleAdditional.longitude),
      rcNumber: checkData(vehicle.Rcnumber),
      registrationYear: checkData(vehicle.Registrationyear)
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
        Additional,
        vehicleImages,
        updatedFeatures
      });
    }
    else {
      res.status(200).json({
        message: "vehicle Additional data, no image found",
        vehicleAdditionals,
        Additional,
        updatedFeatures
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}
const postwishlist = async (req, res) => {
  try {
    const { vehicleid } = req.body;
    const userId = req.user.userid;
    console.log(vehicleid);
    const vehicle = await Vehicle.findOne({
      where: {
        vehicleid: vehicleid,
      }
    });
    if (!vehicle) {
      res.status(404).json({ message: 'Vehicle not found' });
    }
    const wishlist = await Wishlist.findOne({
      where: {
        userid: userId,
        vehicleid: vehicleid,
      }
    });
    if (wishlist) {
      res.status(200).json({ message: 'Wishlist Already added' });
    }
    else {
      await Wishlist.create({
        userid: userId,
        vehicleid: vehicleid,
      })
      res.status(201).json({ message: 'Wishlist Added successfully' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}
const cancelwishlist = async (req, res) => {
  try {
    const { vehicleid } = req.body;
    const userId = req.user.userid;
    const vehicle = await Vehicle.findOne({
      where: {
        vehicleid: vehicleid,
      }
    });
    if (!vehicle) {
      return res.status(404).json({ message: 'vehicle not found' });
    }
    const wishlist = await Wishlist.findOne({
      where: {
        userid: userId,
        vehicleid: vehicleid,
      }
    });
    if (!wishlist) {
      res.status(404).json({ message: 'Wishlist not present' });
    }
    else {
      await Wishlist.destroy({
        where: {
          userid: userId,
          vehicleid: vehicleid,
        }
      });
      res.status(200).json({ message: 'Wishlist removed successfully' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}
const getwishlist = async (req, res) => {
  try {
    const userId = req.user.userid;
    const wishlist = await Wishlist.findAll({ where: { userid: userId } })
    if (!wishlist) {
      res.status(200).json({ message: 'wishlist bucket is empty' });
    }
    console.log(wishlist);
    const userWishlist = wishlist.map(async (wishlists) => {
      const vehicle = await Vehicle.findOne({
        where: {
          vehicleid: wishlists.vehicleid,
        }
      });
      if (!vehicle) {
        return;
      }
      const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: wishlists.vehicleid } });
      let wl;
      wl = {
        vehicleid: checkData(wishlists.vehicleid),
        registrationYear: checkData(vehicle.Registrationyear),
        rcNumber: checkData(vehicle.Rcnumber),
        vehicleType: checkData(vehicle.vehicletype),
        rating: checkData(vehicle.rating),
        latitude: checkData(vehicleAdditional.latitude),
        longitude: checkData(vehicleAdditional.longitude),
        vehicleImage1: checkImage(vehicleAdditional.vehicleimage1),
        vehicleImage2: checkImage(vehicleAdditional.vehicleimage2),
        vehicleImage3: checkImage(vehicleAdditional.vehicleimage3),
        vehicleImage4: checkImage(vehicleAdditional.vehicleimage4),
        vehicleImage5: checkImage(vehicleAdditional.vehicleimage5),
      }
      const cph = await Pricing.findOne({ where: { vehicleid: vehicle.vehicleid } });
      if (cph) {
        const costperhr = cph.costperhr;
        // Include pricing information in the vehicle object
        return { ...wl, costPerHr: costperhr };
      } else {
        return { ...wl, costPerHr: 0 };
      }
      return { ...wl };
    });
    const userWishlists = await Promise.all(userWishlist);
    res.status(201).json({ message: userWishlists });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}

const toprating = async (req, res) => {
  try {
    const topRatings = await Feedback.findAll({
      where: {
        rating: 5
      }
    });

    if (!topRatings || topRatings.length === 0) {
      return res.status(404).json({ message: 'No 5-star ratings found' });
    }

    const feedbackList = topRatings.map(feedback => ({
      vehicleid: feedback.vehicleid,
      userId: feedback.userId,
      userName: checkData(feedback.userName),
      hostId: feedback.hostId,
      rating: checkData(feedback.rating),
      comment: checkData(feedback.comment),
      createdAt: feedback.createdAt
    }));

    res.status(200).json({ message: 'Top 5-star ratings', feedback: feedbackList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}


module.exports = { getbrand, features, getallVehicles, findvehicles, onevehicle, getvehicleadditional, postwishlist, cancelwishlist, getwishlist, toprating, findCabs };