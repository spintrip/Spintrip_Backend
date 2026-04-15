//importing modules
const { User, Vehicle, Chat, UserAdditional, Listing, sequelize, Booking, Pricing,
  carFeature, Feedback, Host, Tax, Wishlist, Feature, Blog, Bike, Car, HostAdditional, Wallet, VehicleAdditional, BookingExtension, Transaction, UserAddress, Driver, DriverAdditional } = require('../../Models');
const path = require('path');
const noImgPath = `https://spintrip-s3bucket.s3.ap-south-1.amazonaws.com/vehicleAdditional/no_profile.png`; 
const uuid = require('uuid');
const KycService = require('../../Utils/KycService');

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
      console.log(additionalInfo);
      if (!additionalInfo) {
        return res.status(404).json({ message: 'Additional user info not found' });
      }
  
      // Construct the URLs for the files stored in S3
      const aadharFile = additionalInfo.aadhar ? [additionalInfo.aadhar] : [];
      const dlFile = additionalInfo.dl ? [additionalInfo.dl] : [];
      const panFile = additionalInfo.pan ? [additionalInfo.pan] : [];
      const profilePic = additionalInfo.profilepic ? [additionalInfo.profilepic] : [];
      
      const { Driver } = require('../../Models');
      const driverData = await Driver.findOne({ where: { id: userId } });

      if (!user.referralCode) {
        const newCode = Math.random().toString(36).substring(2, 6).toUpperCase() + user.phone.slice(-4);
        await user.update({ referralCode: newCode });
        console.log(`Generated referral code for ${user.phone}: ${newCode}`);
      }
      const wallet = await Wallet.findOne({ where: { userId: req.user.id } });
      let profile = {
        id: checkData(additionalInfo.id),
        dlNumber: checkData(additionalInfo.Dlverification),
        fullName: checkData(additionalInfo.FullName),
        email: checkData(additionalInfo.Email),
        aadharNumber: checkData(additionalInfo.AadharVfid),
        panNumber: checkData(additionalInfo.PanVfid),
        address: checkData(additionalInfo.Address),
        verificationStatus: checkStatus(additionalInfo.verification_status),
        dl: checkImage(dlFile),
        aadhar: checkImage(aadharFile),
        pan: checkImage(panFile),
        profilePic: checkImage(profilePic),
        upiId: driverData ? driverData.upiId : null,
        bankAccountNumber: driverData ? driverData.bankAccountNumber : null
      };
  
      res.json({
        user: {
          id: user.id,
          phone: user.phone,
          referralCode: user.referralCode, // 🎫 Now sends your real code
          referralCount: user.referralCount || 0, // 🔢 And the count of successful referrals
          walletBalance: wallet ? wallet.balance : 0, 
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

  // Add this function near the other "get" methods (like getbrand):
const getAllVehicleTypes = async (req, res) => {
  try {
    const { VehicleType } = require('../../Models');
    const types = await VehicleType.findAll();
    const formattedTypes = types.map(t => 
      `${t.vehicletype} ${t.description || ''}`.trim()
    );
    res.status(200).json({ success: true, vehicleTypes: formattedTypes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// IMPORTANT: Remember to add 'getAllVehicleTypes' to the module.exports at the bottom!

  const putprofile = async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Update additional user information
      const { dlNumber, fullName, aadharId, email, address, currentAddressVfId, mlData, upiId, bankAccountNumber } = req.body;
      
      if (user.role === 'Driver' || user.role === 'driver') {
        const { Driver } = require('../../Models');
        const driverExists = await Driver.findOne({ where: { id: userId } });
        if (driverExists) {
           await Driver.update({ upiId: upiId || null, bankAccountNumber: bankAccountNumber || null }, { where: { id: userId } });
        } else {
           await Driver.create({ id: userId, hostid: null, upiId: upiId || null, bankAccountNumber: bankAccountNumber || null });
        }
      }

      const [userAdditional, created] = await UserAdditional.findOrCreate({
        where: { id: userId },
        defaults: { id: userId }
      });

      await userAdditional.update({
        Dlverification: dlNumber,
        FullName: fullName,
        AadharVfid: aadharId,
        Email: email,
        Address: address,
        CurrentAddressVfid: currentAddressVfId,
        ml_data: mlData
      });
  
      res.status(200).json({ message: 'Profile Updated successfully' });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error updating profile', error: error });
    }
  }

  const postaddress = async (req, res) => {
    try {
      const { fullAddress, latitude, longitude, addressType } = req.body;
      const type = addressType || 'Other';

      const userId = req.user.id;
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      if (!fullAddress || !latitude || !longitude) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // 🏆 Smart Overwrite: If Home/Work exists, update it instead of creating duplicates
      if (type === 'Home' || type === 'Work') {
        const existing = await UserAddress.findOne({ where: { userid: userId, addressType: type } });
        if (existing) {
          await existing.update({ fullAddress, latitude, longitude });
          return res.status(200).json({
            message: `${type} address updated successfully`,
            data: existing,
          });
        }
      }
  
      const address = await UserAddress.create({
        id: uuid.v4(),
        userid: userId,
        fullAddress,
        latitude,
        longitude,
        addressType: type,
      });
  
      res.status(201).json({
        message: "Address created successfully",
        data: address,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to create address" });
    }
  };
  const  getaddress = async (req, res) => {
    try {
      const id = req.user.id;
      console.log(req.user.id);
      const address = await UserAddress.findAll({ where: { userid: id } });
  
      if (!address) {
        return res.status(404).json({ message: "Address not found" });
      }
  
      res.status(200).json({
        message: "Address fetched successfully",
        data: address,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch address" });
    }
  };
  
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
        if (req.files['panFile']) files.push(req.files['panFile'][0]);
        if (req.files['profilePic']) files.push(req.files['profilePic'][0]);
      }
  
      const { dlFile, aadharFile, panFile, profilePic } = req.files;
  
      const [userAdditional, created] = await UserAdditional.findOrCreate({
        where: { id: userId },
        defaults: { id: userId }
      });
      
      if (dlFile || aadharFile || panFile) {
        await userAdditional.update({
          dl: dlFile ? dlFile[0].location : undefined,
          aadhar: aadharFile ? aadharFile[0].location : undefined,
          pan: panFile ? panFile[0].location : undefined,
          verification_status: 1
        });
      }
  
      if (profilePic) {
        await userAdditional.update({
          profilepic: profilePic[0].location,
        });
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

  const verifyAadhar = async (req, res) => {
    try {
      const userId = req.user.id;
      const { aadharNumber } = req.body;
  
      if (!aadharNumber) {
        return res.status(400).json({ success: false, message: 'Aadhaar number is required.' });
      }
  
      const result = await KycService.verifyAadhar(aadharNumber);
  
      if (result.success) {
        // Update verification status to 2 (Govt Verified)
        await UserAdditional.update({
          AadharVfid: aadharNumber,
          verification_status: 2, // 2 = GOVERNMENT VERIFIED
          // Note: FullName is NOT updated here to avoid overwriting the user's real name
          //       with a simulated KYC response value.
        }, { where: { id: userId } });
  
        return res.status(200).json({ success: true, message: result.message, name: result.name });
      } else {
        return res.status(400).json({ success: false, message: result.message });
      }
    } catch (error) {
      console.error('Aadhaar Verification Error:', error);
      res.status(500).json({ success: false, message: 'Internal server error during Aadhaar verification.' });
    }
  };
  
  const verifyPan = async (req, res) => {
    try {
      const userId = req.user.id;
      const { panNumber } = req.body;
  
      if (!panNumber) {
        return res.status(400).json({ success: false, message: 'PAN number is required.' });
      }
  
      const result = await KycService.verifyPan(panNumber);
  
      if (result.success) {
        // Update UserAdditional for general storage (Drivers are primarily Users)
        await UserAdditional.update({
          PanVfid: panNumber,
        }, { where: { id: userId } });

        // Also update HostAdditional if they are a host
        const host = await HostAdditional.findOne({ where: { id: userId } });
        if (host) {
            await host.update({ PANnumber: panNumber });
        }
  
        return res.status(200).json({ success: true, message: result.message, name: result.name });
      } else {
        return res.status(400).json({ success: false, message: result.message });
      }
    } catch (error) {
      console.error('PAN Verification Error:', error);
      res.status(500).json({ success: false, message: 'Internal server error during PAN verification.' });
    }
  };

  const verifyDl = async (req, res) => {
    try {
      const { dlNumber } = req.body;
      if (!dlNumber) return res.status(400).json({ success: false, message: 'DL number is required.' });
      
      const result = await KycService.verifyDl(dlNumber);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
       res.status(500).json({ success: false, message: 'DL verification failed.' });
    }
  };
  
  module.exports = {getprofile, putprofile, uploadProfile, deleteuser, getAllVehicleTypes, checkData, checkImage, checkStatus, postaddress, getaddress, verifyAadhar, verifyPan, verifyDl};