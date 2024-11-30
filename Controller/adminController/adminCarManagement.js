const {CarAdditional, Admin, Car} = require('../../Models');
const fs = require('fs');
const path = require('path');

const pendingCarProfile = async (req, res) => {
    try {
      const adminId = req.user.id;
      const admin = await Admin.findByPk(adminId);
  
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
  
      let pendingProfiles = await CarAdditional.findAll({
        where: 
            { verification_status: 1 }
      });
  
      if (pendingProfiles.length === 0) {
        return res.status(200).json({ message: 'No car approval required' });
      }
  
      const updatedProfiles = await Promise.all(
        pendingProfiles.map(async (profile) => {
          const car = await Car.findByPk(profile.vehicleid);
          
          return {
            ...profile.toJSON(),
            car: car ? car.toJSON() : null
          };
        })
      );
  
      res.status(200).json({ pendingProfiles: updatedProfiles });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error fetching pending car profiles', error });
    }
  };

  const approveCarProfile = async (req, res) => {
    try {
      const adminId = req.user.id;
      const admin = await Admin.findByPk(adminId);
      if (!admin){
        return res.status(404).json({ message: 'Admin not found' });
      }
      const vehicleid = req.body.vehicleid;
      await CarAdditional.update({ verification_status: 2 }, { where: { vehicleid: vehicleid } });
      res.status(200).json({ message: 'Car Profile approved successfully' });
    } catch (error) {
      console.log(error);
      }
    };
  
  const rejectCarProfile = async (req, res) => {
    try {
      const adminId = req.user.id;
      const admin = await Admin.findByPk(adminId);
  
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      const userId = req.body.userId;
      await UserAdditional.update({ dl: null , aadhar: null, verification_status: null }, { where: { id: userId } });
      res.status(200).json({ message: 'Profile rejected successfully' });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error rejected profile', error });
    }
  };

  module.exports = {pendingCarProfile, approveCarProfile, rejectCarProfile};