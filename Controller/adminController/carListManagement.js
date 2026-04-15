const { Vehicle, VehicleAdditional, Listing , Car, Bike, Cab, User, UserAdditional } = require('../../Models');

// Helper to resolve vehicle brand + model
const resolveVehicleName = async (vehicleId, type) => {
  try {
    if (!vehicleId) return 'N/A';
    if (type == 1) { // Bike
      const bike = await Bike.findByPk(vehicleId);
      return bike ? `${bike.brand} ${bike.bikemodel}` : 'Bike ID: ' + vehicleId;
    } else if (type == 2) { // Car
      const car = await Car.findByPk(vehicleId);
      return car ? `${car.brand} ${car.carmodel}` : 'Car ID: ' + vehicleId;
    } else if (type == 3) { // Cab
      const cab = await Cab.findByPk(vehicleId);
      return cab ? `${cab.brand} ${cab.model}` : 'Cab ID: ' + vehicleId;
    }
    return 'Vehicle ID: ' + vehicleId;
  } catch (error) {
    return 'Error resolving name';
  }
};


// Get all cars with additional information
const getAllvehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll();
    const vehiclesWithAdditionalInfo = await Promise.all(
      vehicles.map(async (vehicle) => {
        const additionalInfo = await VehicleAdditional.findOne({ where: { vehicleid: vehicle.vehicleid } });
        const vehicleName = await resolveVehicleName(vehicle.vehicleid, vehicle.vehicletype);
        
        let hostName = 'N/A';
        let hostPhone = 'N/A';
        if (vehicle.hostId) {
          const host = await User.findByPk(vehicle.hostId, { include: [{ model: UserAdditional }] });
          if (host) {
            hostPhone = host.phone;
            hostName = host.UserAdditional?.FullName || 'N/A';
          }
        }

        return {
          ...vehicle.toJSON(),
          vehicleName: vehicleName,
          hostName: hostName,
          hostPhone: hostPhone,
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

const postActiveVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    // Allow toggling: if activated is provided in body use it, otherwise default to true
    const newStatus = req.body.activated !== undefined ? req.body.activated : true;
    
    await vehicle.update({ activated: newStatus });

    res.status(200).json({ 
      message: `Vehicle ${newStatus ? 'activated' : 'deactivated'} successfully`, 
      activated: newStatus,
      vehicle 
    });
  } catch (error) {
    console.log("Error toggling vehicle activation:", error);
    res.status(500).json({ message: 'Error updating vehicle activation status', error: error.message });
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
    const vehicleName = await resolveVehicleName(vehicle.vehicleid, vehicle.vehicletype);
    
    res.status(200).json({
      vehicle: {
        ...vehicle.toJSON(),
        vehicleName,
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
    const cars = await Car.findAll();
    const enrichedCars = await Promise.all(cars.map(async (car) => {
      const vehicle = await Vehicle.findByPk(car.vehicleid);
      return {
        ...car.toJSON(),
        vehicleType: vehicle?.vehicletype || '2',
        activated: vehicle?.activated || false
      };
    }));

    return res.status(200).json({ car: enrichedCars });

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
    const bikes = await Bike.findAll();
    const enrichedBikes = await Promise.all(bikes.map(async (bike) => {
      const vehicle = await Vehicle.findByPk(bike.vehicleid);
      return {
        ...bike.toJSON(),
        vehicleType: vehicle?.vehicletype || '1',
        activated: vehicle?.activated || false
      };
    }));
    return res.status(200).json({ bike: enrichedBikes });

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
  bikeById,
  postActiveVehicle
};
