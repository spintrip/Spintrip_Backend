const { Host, Car, User, Listing, HostAdditional, UserAdditional, Booking, Pricing, Brand, Feedback, carFeature, Feature, Blog, carDevices, Device, Transaction, Vehicle, Bike, VehicleAdditional, HostPayment } = require('../../Models');


 const allFeatures = async (req, res) => {
    try {
      const features = await Feature.findAll();
      res.status(200).json(features);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error fetching features', error });
    }
  };

  
  const postFeatures = async (req, res) => {
    try {
      const {
        featureid,
        vehicleid,
        price
      } = req.body;
      const feature = await Feature.findOne({ where: { id: featureid } });
      if (!feature) {
        return res.status(400).json({ message: 'Feature not available' });
      }
      else {
        const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid, hostId: req.user.id } });
        if (!vehicle) {
          return res.status(400).json({ message: 'vehicle is not available' });
        }
        const carfeature = await carFeature.findOne({ where: { featureid: featureid, vehicleid: vehicleid } });
        if (carfeature) {
          return res.status(400).json({ message: 'vehicle feature already added' });
        }
        const updated_feature = await carFeature.create({
          featureid: featureid,
          vehicleid: vehicleid,
          price: price
        });
        let response = {
          vehicleid: updated_feature.vehicleid,
          featureid: updated_feature.featureid,
          price: updated_feature.price,
        }
        res.status(201).json({ message: 'Feature with Price added', response });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error Adding car feature Details' });
    }
  };


  // Update Feature
 const updateFeatures = async (req, res) => {
    try {
      const { featureid, vehicleid, price } = req.body;
  
      const carFeatureRecord = await carFeature.findOne({ where: { featureid, vehicleid } });
      if (!carFeatureRecord) {
        return res.status(404).json({ message: 'Feature not found for the car' });
      }
  
      const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid, hostId: req.user.id } });
      if (!vehicle) {
        return res.status(400).json({ message: 'vehicle is not available' });
      }
  
      await carFeatureRecord.update({ price });
  
      res.status(200).json({ message: 'Feature price updated successfully', carFeatureRecord });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error updating car feature details' });
    }
  };
  
  // Delete Feature
  const deleteFeatures = async (req, res) => {
    try {
      const { featureid, vehicleid } = req.body;
  
      const carFeatureRecord = await carFeature.findOne({ where: { featureid, vehicleid } });
      if (!carFeatureRecord) {
        return res.status(404).json({ message: 'Feature not found for the car' });
      }
  
      const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid, hostId: req.user.id } });
      if (!vehicle) {
        return res.status(400).json({ message: 'vehicle is not available' });
      }
  
      await carFeatureRecord.destroy();
  
      res.status(200).json({ message: 'Feature deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error deleting vehicle feature' });
    }
  };

  module.exports = {allFeatures, postFeatures, updateFeatures, deleteFeatures};