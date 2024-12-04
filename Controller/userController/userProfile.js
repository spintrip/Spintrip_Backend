//importing modules
 const { User, Vehicle, Chat, UserAdditional, Listing, sequelize, Booking, Pricing,
  carFeature, Feedback, Host, Tax, Wishlist, Feature, Blog, Bike, Car, HostAdditional, VehicleAdditional, BookingExtension, Transaction } = require('../../Models');
 const path = require('path');
 const noImgPath = path.resolve(__dirname, '../assets/no_profile.webp'); 
  
 
 const checkData = (value) => {
    return value !== null && value !== undefined ? value : "Not Provided";
  }
  const checkImage = (value) => {
    return value !== null && value !==undefined && value.length > 0 ? value : noImgPath;
  }
  const checkStatus = (value) => {
    return value !== null && value !== undefined  ? value : 0;
  }


 const getprofile = async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await User.findByPk(userId);
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      const additionalInfo = await UserAdditional.findByPk(userId);
  
      if (!additionalInfo) {
        return res.status(404).json({ message: 'Additional user info not found' });
      }
  
      // Construct the URLs for the files stored in S3
      const aadharFile = additionalInfo.aadhar ? [additionalInfo.aadhar] : [];
      const dlFile = additionalInfo.dl ? [additionalInfo.dl] : [];
      const profilePic = additionalInfo.profilepic ? [additionalInfo.profilepic] : [];
  
      let profile = {
        id: checkData(additionalInfo.id),
        dlNumber: checkData(additionalInfo.Dlverification),
        fullName: checkData(additionalInfo.FullName),
        email: checkData(additionalInfo.Email),
        aadharNumber: checkData(additionalInfo.AadharVfid),
        address: checkData(additionalInfo.Address),
        verificationStatus: checkStatus(additionalInfo.verification_status),
        dl: checkImage(dlFile),
        aadhar: checkImage(aadharFile),
        profilePic: checkImage(profilePic)
      };
  
      res.json({
        user: {
          id: user.id,
          phone: user.phone,
          role: user.role,
          rating: checkData(user.rating),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        profile
      });
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
  const putprofile = async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Update additional user information
      const { dlNumber, fullName, aadharId, email, address, currentAddressVfId, mlData } = req.body;
      await UserAdditional.update({
        id: userId,
        Dlverification: dlNumber,
        FullName: fullName,
        AadharVfid: aadharId,
        Email: email,
        Address: address,
        CurrentAddressVfid: currentAddressVfId,
        ml_data: mlData
      }, { where: { id: userId } });
  
      res.status(200).json({ message: 'Profile Updated successfully' });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error updating profile', error: error });
    }
  }

  const uploadProfile = async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      let files = [];
      if (req.files) {
        if (req.files['aadharFile']) files.push(req.files['aadharFile'][0]);
        if (req.files['dlFile']) files.push(req.files['dlFile'][0]);
        if (req.files['profilePic']) files.push(req.files['profilePic'][0]);
      }
  
      const { dlFile, aadharFile, profilePic } = req.files;
  
      if (dlFile || aadharFile) {
        await UserAdditional.update({
          dl: dlFile ? dlFile[0].location : undefined,
          aadhar: aadharFile ? aadharFile[0].location : undefined,
          verification_status: 1
        }, { where: { id: userId } });
      }
  
      if (profilePic) {
        await UserAdditional.update({
          profilepic: profilePic[0].location,
        }, { where: { id: userId } });
      }
  
      res.status(200).json({ message: 'Profile Updated successfully' });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error updating profile', error: error });
    }
  };

  const deleteuser = async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      await user.destroy();
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error deleting user', error });
    }
  };

  module.exports = {getprofile, putprofile, uploadProfile, deleteuser, checkData, checkImage, checkStatus};