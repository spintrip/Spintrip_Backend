const VehicleType = require('../../Models/vehicleTypeModel');

// --- Vehicle Type Management ---

// Create a new vehicle type
const createVehicleType = async (req, res) => {
  try {
    const { typeName, description, basePrice } = req.body;
    const newVehicleType = new VehicleType({
      typeName,
      description,
      basePrice
    });
    await newVehicleType.save();
    res.status(201).json({ success: true, message: 'Vehicle type created successfully', vehicleType: newVehicleType });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get all vehicle types
const getAllVehicleTypes = async (req, res) => {
  try {
    const vehicleTypes = await VehicleType.find();
    res.status(200).json({ success: true, vehicleTypes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Delete a vehicle type by ID
const deleteVehicleType = async (req, res) => {
  try {
    const vehicleType = await VehicleType.findByIdAndDelete(req.params.id);
    if (!vehicleType) {
      return res.status(404).json({ success: false, message: 'Vehicle type not found' });
    }
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
