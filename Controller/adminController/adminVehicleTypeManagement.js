const { VehicleType } = require('../../Models');

// --- Vehicle Type Management ---

// Create a new vehicle type
const createVehicleType = async (req, res) => {
  try {
    const { name, description, basePrice } = req.body;
    const newVehicleType = await VehicleType.create({
      vehicletype: name,
      description,
      basePrice
    });
    res.status(201).json({ success: true, message: 'Vehicle type created successfully', vehicleType: newVehicleType });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get all vehicle types
const getAllVehicleTypes = async (req, res) => {
  try {
    const vehicleTypes = await VehicleType.findAll();
    res.status(200).json({ success: true, vehicleTypes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Delete a vehicle type by ID
const deleteVehicleType = async (req, res) => {
  try {
    const vehicleType = await VehicleType.findByPk(req.params.id);
    if (!vehicleType) {
      return res.status(404).json({ success: false, message: 'Vehicle type not found' });
    }
    await vehicleType.destroy();
    res.status(200).json({ success: true, message: 'Vehicle type deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  createVehicleType,
  getAllVehicleTypes,
  deleteVehicleType
};
