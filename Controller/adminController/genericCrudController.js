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

const createRecord = async (req, res) => {
  try {
    const model = getModel(req.params.modelName);
    console.log(`[AdminCRUD] Attempting to create record for model: ${req.params.modelName}`);
    if (!model) {
      console.log(`[AdminCRUD] Model not found: ${req.params.modelName}`);
      return res.status(404).json({ success: false, message: `Model '${req.params.modelName}' not found` });
    }
    
    // Sandbox restriction: Cab admins can only create Vehicles of type 3
    if (req.user && req.user.adminRole === 'cabadmin' && model.name === 'Vehicle') {
      req.body.vehicletype = '3';
    }

    // Sanitize payload: strip out empty strings so PostgreSQL defaults take over
    Object.keys(req.body).forEach(k => {
      if (req.body[k] === '' || req.body[k] === null || req.body[k] === undefined) {
        delete req.body[k];
      }
    });

    const pk = model.primaryKeyAttribute || 'id';
    if (!req.body[pk] && model.rawAttributes[pk] && !model.rawAttributes[pk].autoIncrement) {
      req.body[pk] = uuidv4();
    }
    
    console.log(`[AdminCRUD] Final payload for ${model.name}:`, req.body);

    const record = await model.create(req.body);
    console.log(`[AdminCRUD] Success! Record created for ${model.name}`);
    res.status(201).json({ success: true, message: `${req.params.modelName} created successfully`, data: record });
  } catch (error) {
    console.error(`[AdminCRUD] Create Error in model ${req.params.modelName}:`, error.message);
    console.error(error.stack);
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
