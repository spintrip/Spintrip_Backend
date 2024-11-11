const { Vehicle, VehicleAdditional, Listing } = require('../../Models');

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
    const vehicle = await VehiclefindByPk(req.params.id);
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
    res.status(200).json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting listing', error });
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
  deleteListingById 
};
