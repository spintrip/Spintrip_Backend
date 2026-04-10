const {UserAdditional, Admin, User, HostAdditional, DriverAdditional} = require('../../Models');
const fs = require('fs');
const path = require('path');

// Set up multer storage with S3


const pendingProfile = async (req, res) => {
    try {
      const adminId = req.user.id;
      const admin = await Admin.findByPk(adminId);
  
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
  
      let pendingProfiles = await UserAdditional.findAll({
        where: { verification_status: 1 }
      });
  
      if (pendingProfiles.length === 0) {
        return res.status(200).json({ message: 'No user approval required' });
      }
  
      const updatedProfiles = await Promise.all(
        pendingProfiles.map(async (profile) => {
          const user = await User.findByPk(profile.id);
          
          let fullName = profile.FullName;
          
          // If name is missing in UserAdditional, try specialized tables
          if (!fullName && user) {
            if (user.role === 'host' || user.role === 'Host') {
              const hostInfo = await HostAdditional.findOne({ where: { id: user.id } });
              fullName = hostInfo?.FullName || hostInfo?.businessName;
            } else if (user.role === 'driver' || user.role === 'Driver') {
              const driverInfo = await DriverAdditional.findOne({ where: { id: user.id } });
              fullName = driverInfo?.FullName;
            }
          }

          let userFolder = path.join('./uploads', profile.id.toString());
          let aadharFile = [];
          let dlFile = [];
          
          if (fs.existsSync(userFolder)) {
            let files = fs.readdirSync(userFolder);
            aadharFile = files.filter(file => file.includes('aadharFile')).map(file => `${process.env.BASE_URL}/uploads/${profile.id}/${file}`);
            dlFile = files.filter(file => file.includes('dlFile')).map(file => `${process.env.BASE_URL}/uploads/${profile.id}/${file}`);
          }
          
          return {
            ...profile.toJSON(),
            FullName: fullName || profile.FullName || '--',
            aadharFile: aadharFile[0] || null,
            dlFile: dlFile[0] || null,
            user: user ? user.toJSON() : null
          };
        })
      );
  
      res.status(200).json({ updatedProfiles });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error fetching pending profiles', error });
    }
  };

  const approveProfile = async (req, res) => {
    try {
      const adminId = req.user.id;
      const admin = await Admin.findByPk(adminId);
  
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      const userId = req.body.userId;
      await UserAdditional.update({ verification_status: 2 }, { where: { id: userId } });
      res.status(200).json({ message: 'Profile approved successfully' });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error approving profile', error });
    }
  };

  const rejectProfile = async (req, res) => {
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

  module.exports = {pendingProfile, approveProfile, rejectProfile};
  