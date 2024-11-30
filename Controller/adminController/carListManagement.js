const { Vehicle, VehicleAdditional, Listing , Car, Bike } = require('../../Models');

// Get all cars with additional information
const getAllvehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll();
    const vehiclesWithAdditionalInfo = await Promise.all(
      vehicles.map(async (vehicle) => {
        const additionalInfo = await VehicleAdditional.findOne({ where: { vehicleid: vehicle.vehicleid } });
        return {
          ...vehicle.toJSON(),
          additionalInfo: additionalInfo ? additionalInfo.toJSON() : null,
        };
      })
    );

    res.status(200).json({ message: "All available vehicles", vehicles: vehiclesWithAdditionalInfo });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching vehicles', error });
  }
};

// Get a car by ID with additional information
const getvehicleById = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    const additionalInfo = await VehicleAdditional.findOne({ where: { vehicleid: vehicle.vehicleid } });
    res.status(200).json({
      vehicle: {
        ...vehicle.toJSON(),
        additionalInfo: additionalInfo ? additionalInfo.toJSON() : null,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching vehicle', error });
  }
};

// Update a car by ID
const updatevehicleById = async (req, res) => {
  try {
    const { vehicleid } = req.params;
    const { additionalInfo, ...vehicleData } = req.body;

    const [updated] = await Vehicle.update(vehicleData, { where: { vehicleid } });
    if (!updated) {
      return res.status(404).json({ message: 'vehicle not found' });
    }

    if (additionalInfo) {
      let additionalRecord = await VehicleAdditional.findOne({ where: { vehicleid } });
      if (additionalRecord) {
        await additionalRecord.update(additionalInfo);
      }
    }

    const updatedVehicle = await Vehicle.findByPk(vehicleid);
    const updatedAdditionalInfo = await VehicleAdditional.findOne({ where: { vehicleid } });

    res.status(200).json({
      message: 'Vehicle updated successfully',
      car: {
        ...updatedVehicle.toJSON(),
        additionalInfo: updatedAdditionalInfo ? updatedAdditionalInfo.toJSON() : null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating Vehicle', error });
  }
};

// Delete a car by ID
const deletevehicleById = async (req, res) => {
  try {
    await Vehicle.destroy({ where: { vehicleid: req.params.id } });
    res.status(200).json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting car', error });
  }
};

// Get all listings
const getAllListings = async (req, res) => {
  try {
    const listings = await Listing.findAll();
    res.status(200).json({ message: 'All available listings', listings });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching listings', error });
  }
};

// Get a listing by ID
const getListingById = async (req, res) => {
  try {
    const listing = await Listing.findByPk(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }
    res.status(200).json({ listing });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching listing', error });
  }
};

// Update a listing by ID
const updateListingById = async (req, res) => {
  try {
    const listing = await Listing.update(req.body, { where: { id: req.params.id } });
    res.status(200).json({ message: 'Listing updated successfully', listing });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error updating listing', error });
  }
};

// Delete a listing by ID
const deleteListingById = async (req, res) => {
  try {
    await Listing.destroy({ where: { id: req.params.id } });
    return res.status(200).json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: 'Error deleting listing', error });
  }
};


// Get all listings
const cars = async (req, res) => {
  try {
    const car = await Car.findAll();
    if (!car) {
      return res.status(404).json({ message: 'Cars not found' });
    }

    return res.status(200).json({ car});
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: 'Error fetching car', error });
  }
};

// Get a listing by ID
const carsById = async (req, res) => {
  try {
    const car = await Car.findByPk(req.params.id);
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

   return res.status(200).json({ car });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: 'Error fetching car', error });
  }
};

// Update a listing by ID
const updateCars = async (req, res) => {
  try {
    const { vehicleid } = req.params;
    const updateFields = {};
    const { additionalInfo, ...carData } = req.body;

    // Update Car data
    for (let key in carData) {
      if (carData.hasOwnProperty(key)) {
        updateFields[key] = carData[key];
      }
    }

    const [updated] = await Car.update(updateFields, { where: { vehicleid } });

    // Fetch updated car with additional info
    const updatedCar = await Car.findByPk(vehicleid);

    return res.status(200).json({
      message: 'Car updated successfully', updatedCar
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error updating car', error });
  }
};

// Delete a listing by ID
const deleteCars = async (req, res) => {
  try {
    await Car.destroy({ where: { vehicleid: req.params.id } });
    return res.status(200).json({ message: 'Car deleted' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: 'Error deleting car', error });
  }
};

const bikes = async (req, res) => {
  try {
    const bike = await Bike.findAll();
    if (!bike) {
      return res.status(404).json({ message: 'Bike not found' });
    }
    return res.status(200).json({ bike });
  } catch (error) {
    console.log(error);
   return res.status(500).json({ message: 'Error fetching Bike', error });
  }
};

// Get a listing by ID
const bikeById = async (req, res) => {
  try {
    const bike = await Bike.findByPk(req.params.id);
    if (!bike) {
      return res.status(404).json({ message: 'Bike not found' });
    }
    return res.status(200).json({ bike });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: 'Error fetching Bike', error });
  }
};

// Update a listing by ID
const updateBike = async (req, res) => {
  try {
    const { vehicleid } = req.params;
    const updateFields = {};
    const { bikeData } = req.body;

    // Update Car data
    for (let key in bikeData) {
      if (bikeData.hasOwnProperty(key)) {
        updateFields[key] = bikeData[key];
      }
    }

    const [updated] = await Bike.update(updateFields, { where: { vehicleid } });

    // if (!updated) {
    //   return res.status(404).json({ message: 'Car not found' });
    // }

    // Fetch updated car with additional info
    const updatedBike = await Bike.findByPk(vehicleid);

    return res.status(200).json({
      message: 'Bike updated successfully',
        updatedBike,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error updating Bike', error });
  }
};

// Delete a listing by ID
const deleteBike = async (req, res) => {
  try {
    await Bike.destroy({ where: { vehicleid: req.params.id } });
    return res.status(200).json({ message: 'Bike deleted' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: 'Error deleting Bike', error });
  }
};

module.exports = { 
  getAllvehicles, 
  getvehicleById, 
  updatevehicleById, 
  deletevehicleById, 
  getAllListings, 
  getListingById, 
  updateListingById, 
  deleteListingById,
  cars,
  carsById,
  updateCars,
  deleteCars,
  bikes,
  updateBike,
  deleteBike,
  bikeById
};
