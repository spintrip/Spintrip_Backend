const {  carDevices, Device, Vehicle } = require('../../Models');


const deviceVehicleId = async (req, res) =>{
    try {
      const id = req.params.vehicleid;
      const limit = parseInt(req.query.limit, 10) || 10; 
      const hostId = req.user.id;
      const vehicle = await Vehicle.findOne({ where: { vehicleid: id, hostId: hostId } });
      if (!vehicle) {
        return res.status(404).json({ message: 'vehicle not found or unauthorized access' });
      }
      const device = await carDevices.findOne({ where: { vehicleid: id } });
      if (!device) {
        return res.status(404).json({ message: 'vehicle not available for tracking' });
      }
      const results = await Device.findAll({
        where: {
          deviceid: device.deviceid,
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

  module.exports = {deviceVehicleId};
  