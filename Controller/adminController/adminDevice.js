const {Device, Car, carDevices, Admin, Vehicle } = require('../../Models')


const getDevice = async (req, res) => {
    const queryParams = req.query;
    try {
      // Create new device entry in the database
      const newDevice = await Device.create({
        deviceid: queryParams.id,
        lat: queryParams.lat,
        lng: queryParams.lng,
        speed: queryParams.speed,
        date: queryParams.date,
        time: queryParams.time,
      });
  
      console.log('Data saved to database successfully:', newDevice.toJSON());
      res.status(200).send('Payload saved successfully');
    } catch (error) {
      console.error('Error saving data to database:', error.message);
      res.status(500).send('Error saving data to database');
    }
  };


  const getDeviceById = async (req, res) => {
    const id = req.params.id;
    const limit = parseInt(req.query.limit, 10) || 10; 
  
    try {
      const results = await Device.findAll({
        where: {
          deviceid: id,
        },
        order: [['createdAt', 'DESC']],
        limit: limit, // Apply the limit
      });
  
      if (results.length === 0) {
        return res.status(404).send('No data found for the provided id');
      }
  
      res.json(results);
    } catch (error) {
      console.error('Error retrieving data from database:', error.message);
      res.status(500).send('Error retrieving data from database');
    }
  };
  
  
 const postCarDevice = async(req, res) => {
    try {
      const { deviceid, vehicleid } = req.body;
      const car = await Car.findOne({
        where: {
          vehicleid: vehicleid,
        }})
      if(!car){
        return res.status(400).json({ message: 'Car not found' });
      }  
      const mapping = await carDevices.findOne({
        where: {
          [Op.or]: [
            { vehicleid: vehicleid },
            { deviceid: deviceid }
          ]
        }
      });
      if(mapping)
      {
        return res.status(400).json({ message: 'Car or device id already mapped' });
      }  
      const newMapping = await carDevices.create({ deviceid, vehicleid });
  
      res.status(201).json({ message: 'Mapping created successfully', newMapping });
    } catch (error) {
      console.error('Error creating mapping:', error.message);
      res.status(500).json({ message: 'Error creating mapping', error });
    }
  };
  
  // READ - Get all mappings
  const getCarDevice = async (req, res) => {
    try {
      const mappings = await carDevices.findAll();
  
      if (mappings.length === 0) {
        return res.status(404).json({ message: 'No mappings found' });
      }
      res.json(mappings);
    } catch (error) {
      console.error('Error fetching mappings:', error.message);
      res.status(500).json({ message: 'Error fetching mappings', error });
    }
  };
  
  const getCarDeviceById = async (req, res) => {
    const { id } = req.params;
  
    try {
      const mapping = await carDevices.findByPk(id);
  
      if (!mapping) {
        return res.status(404).json({ message: 'Mapping not found' });
      }
      res.json(mapping);
    } catch (error) {
      console.error('Error fetching mapping:', error.message);
      res.status(500).json({ message: 'Error fetching mapping', error });
    }
  };
  
  
  const updateCarDevice = async (req, res) => {
  
    const { deviceid, vehicleid } = req.body;
  
    try {
      const mapping = await carDevices.findByPk(deviceid);
  
      if (!mapping) {
        return res.status(404).json({ message: 'Mapping not found' });
      }
      const car = await Car.findOne({
        where: {
          vehicleid: vehicleid,
        }})
      if(!car){
        return res.status(400).json({ message: 'Car not found' });
      } 
  
      mapping.vehicleid = vehicleid !== undefined ? vehicleid : mapping.vehicleid;
  
      await mapping.save();
  
      res.json({ message: 'Mapping updated successfully', mapping });
    } catch (error) {
      console.error('Error updating mapping:', error.message);
      res.status(500).json({ message: 'Error updating mapping', error });
    }
  };
  
  
  const deleteCarDeviceById = async(req, res) => {
    const { id } = req.params;
  
    try {
      const mapping = await carDevices.findByPk(id);
  
      if (!mapping) {
        return res.status(404).json({ message: 'Mapping not found' });
      }
  
      await mapping.destroy();
  
      res.json({ message: 'Mapping deleted successfully' });
    } catch (error) {
      console.error('Error deleting mapping:', error.message);
      res.status(500).json({ message: 'Error deleting mapping', error });
    }
  };

  module.exports = {getDevice, getDeviceById, postCarDevice,getCarDevice, getCarDeviceById, updateCarDevice, deleteCarDeviceById};