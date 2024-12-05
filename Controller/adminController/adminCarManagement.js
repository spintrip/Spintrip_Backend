const {CarAdditional, Admin, Vehicle, VehicleAdditional} = require('../../Models');
const fs = require('fs');
const path = require('path');

const pendingVehicleProfile = async (req, res) => {
    try {
      const adminId = req.user.id;
      const admin = await Admin.findByPk(adminId);
  
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
  
      let pendingProfiles = await VehicleAdditional.findAll({
        where: 
            { verification_status: 1 }
      });
  
      if (pendingProfiles.length === 0) {
        return res.status(200).json({ message: 'No vehicle approval required' });
      }
  
      const updatedProfiles = await Promise.all(
        pendingProfiles.map(async (profile) => {
          const vehicle = await Vehicle.findByPk(profile.vehicleid);
          
          return {
            ...profile.toJSON(),
            vehicle: vehicle ? vehicle.toJSON() : null
          };
        })
      );
  
      res.status(200).json({ pendingProfiles: updatedProfiles });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error fetching pending car profiles', error });
    }
  };

  const approveVehicleProfile = async (req, res) => {
    try {
      const adminId = req.user.id;
      const admin = await Admin.findByPk(adminId);
      if (!admin){
        return res.status(404).json({ message: 'Admin not found' });
      }
      const vehicleid = req.body.vehicleid;
      await VehicleAdditional.update({ verification_status: 2 }, { where: { vehicleid: vehicleid } });
      res.status(200).json({ message: 'Vehicle Profile approved successfully' });
    } catch (error) {
      console.log(error);
      }
    };
  
  const rejectVehicleProfile = async (req, res) => {
    try {
      const adminId = req.user.id;
      const admin = await Admin.findByPk(adminId);
  
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      const vehicleid = req.body.vehicleid;
      await VehicleAdditional.update({ verification_status: null }, { where: { vehicleid: vehicleid } });
      res.status(200).json({ message: 'Profile rejected successfully' });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error rejected profile', error });
    }
  };

  module.exports = {pendingVehicleProfile, approveVehicleProfile, rejectVehicleProfile};