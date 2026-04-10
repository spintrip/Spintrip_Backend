const db = require('../../Models/index');
const { v4: uuidv4 } = require('uuid');
const { notifyBookingAllocation } = require('../../Utils/notificationService');

// Helper to resolve model name safely
const getModel = (modelName) => {
  if (!modelName) return null;
  // Try exact match first
  if (db[modelName]) return db[modelName];
  // Try capitalized first letter
  const capitalized = modelName.charAt(0).toUpperCase() + modelName.slice(1);
  if (db[capitalized]) return db[capitalized];
  
  // Try searching case-insensitively
  const modelKeys = Object.keys(db).filter(key => key !== 'sequelize' && key !== 'Sequelize');
  const matchedKey = modelKeys.find(key => key.toLowerCase() === modelName.toLowerCase());
  if (matchedKey) return db[matchedKey];

  return null;
};

// Create a new record
const createRecord = async (req, res) => {
  try {
    const model = getModel(req.params.modelName);
    if (!model) return res.status(404).json({ success: false, message: `Model '${req.params.modelName}' not found` });
    
    // Sandbox restriction: Cab admins can only create Vehicles of type 3
    if (req.user && req.user.adminRole === 'cabadmin' && model.name === 'Vehicle') {
      req.body.vehicletype = '3';
    }

    // Auto-generate UUID for missing primary keys if the model isn't autoIncrement
    const pk = model.primaryKeyAttribute || 'id';
    if (!req.body[pk] && model.rawAttributes[pk] && !model.rawAttributes[pk].autoIncrement) {
      req.body[pk] = uuidv4();
    }

    const record = await model.create(req.body);
    res.status(201).json({ success: true, message: `${req.params.modelName} created successfully`, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get all records
const getAllRecords = async (req, res) => {
  try {
    const model = getModel(req.params.modelName);
    if (!model) return res.status(404).json({ success: false, message: `Model '${req.params.modelName}' not found` });
    
    let whereClause = {};

    // Sandbox restriction: Cab admins can only see Vehicles of type 3
    if (req.user && req.user.adminRole === 'cabadmin' && model.name === 'Vehicle') {
      whereClause.vehicletype = '3';
    }

    // Pagination and basic filtering can be added via req.query if needed
    const records = await model.findAll({ where: whereClause });
    res.status(200).json({ success: true, count: records.length, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get a single record by Primary Key
const getRecordById = async (req, res) => {
  try {
    const model = getModel(req.params.modelName);
    if (!model) return res.status(404).json({ success: false, message: `Model '${req.params.modelName}' not found` });
    
    const pk = model.primaryKeyAttribute || 'id';
    let whereClause = { [pk]: req.params.id };

    // Sandbox restriction: Protect self-drive vehicles from CAB admin lookups
    if (req.user && req.user.adminRole === 'cabadmin' && model.name === 'Vehicle') {
      whereClause.vehicletype = '3';
    }

    const record = await model.findOne({ where: whereClause });
    
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Update a record
const updateRecord = async (req, res) => {
  try {
    const model = getModel(req.params.modelName);
    if (!model) return res.status(404).json({ success: false, message: `Model '${req.params.modelName}' not found` });
    
    const pk = model.primaryKeyAttribute || 'id';
    let whereClause = { [pk]: req.params.id };

    // Sandbox restriction: Protect self-drive vehicles from CAB admin updates
    if (req.user && req.user.adminRole === 'cabadmin' && model.name === 'Vehicle') {
      whereClause.vehicletype = '3';
      req.body.vehicletype = '3'; // Force body input to remain '3'
    }

    const record = await model.findOne({ where: whereClause });
    
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    await record.update(req.body);

    // --- GENERIC NOTIFICATION HOOK ---
    // If we are updating a booking and a driver is assigned, fire the notification.
    const isBookingModel = model.name === 'CabBookingRequest' || model.name === 'Booking';
    if (isBookingModel && req.body.driverid) {
        // Run in background so as not to block the CRUD response
        notifyBookingAllocation(
            record.bookingId || record.id, 
            req.body.driverid, 
            record.userId
        ).catch(e => console.error("Generic Hook Notification Error:", e.message));
    }

    res.status(200).json({ success: true, message: 'Record updated successfully', data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Delete a record
const deleteRecord = async (req, res) => {
  try {
    const model = getModel(req.params.modelName);
    if (!model) return res.status(404).json({ success: false, message: `Model '${req.params.modelName}' not found` });
    
    const pk = model.primaryKeyAttribute || 'id';
    let whereClause = { [pk]: req.params.id };

    // Sandbox restriction: Protect self-drive vehicles from CAB admin deletes
    if (req.user && req.user.adminRole === 'cabadmin' && model.name === 'Vehicle') {
      whereClause.vehicletype = '3';
    }

    const record = await model.findOne({ where: whereClause });
    
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    await record.destroy();
    res.status(200).json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  createRecord,
  getAllRecords,
  getRecordById,
  updateRecord,
  deleteRecord
};
