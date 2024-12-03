const { Host, Car, User, Listing, HostAdditional, UserAdditional, Booking, Pricing, Brand, Feedback, carFeature, Feature, Blog, carDevices, Device, Transaction, Vehicle, Bike, VehicleAdditional, HostPayment } = require('../../Models');
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../../s3Config');
const fs = require('fs');
const path = require('path');
const noProfileImg = path.resolve(__dirname , '../assets/no_profile.webp')



const profileImageStorage = multerS3({
    s3: s3,
    bucket: 'spintrip-bucket',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const userId = req.user.id;
      const fileName = `${file.fieldname}${path.extname(file.originalname)}`;
      const filePath = `${userId}/${fileName}`;
      cb(null, filePath);
    }
  });
  const upload = multer({ storage: profileImageStorage });

  
// Host Profile
const hostProfile = async(req, res) => {
    try {
      const hostId = req.user.id;
      const host = await Host.findByPk(hostId);
      if (!host) {
        return res.status(404).json({ message: 'Host not found' });
      }
      const user = await User.findOne({ where: { id: hostId } });
      const vehicle = await Vehicle.findAll({ where: { hostId: host.id } })
      const checkData = (value) => {
        return value !== null && value !== undefined ? value : 'Not Provided';
      } 
      const checkProfileImg = (value) => {
        return value !== null && value !== undefined ? value : noProfileImg;
      } 
      let additionalInfo = await HostAdditional.findByPk(hostId);
      console.log(additionalInfo);
      let hostDetails = {
        id: host.id,
        onlyVerifiedUsers: host.onlyVerifiedUsers,
        createdAt: host.createdAt,
        updatedAt: host.updatedAt,
        userId : checkData(host.userId)
      }

      const processedVehicles = vehicle.map((vehicleDetail) => ({
        vehicleid: checkData(vehicleDetail?.vehicleid),
        vehicletype: checkData(vehicleDetail?.vehicletype),
        chassisno: checkData(vehicleDetail?.chassisno),
        Rcnumber: checkData(vehicleDetail?.Rcnumber),
        Enginenumber: checkData(vehicleDetail?.Enginenumber),
        Registrationyear: checkData(vehicleDetail?.Registrationyear),
        timestamp: checkData(vehicleDetail?.timestamp),
        rating: checkData(vehicleDetail?.rating),
        activated: checkData(vehicleDetail?.activated),
        hostId: checkData(vehicleDetail?.hostId),
        createdAt: checkData(vehicleDetail?.createdAt),
        updatedAt: checkData(vehicleDetail?.updatedAt),
      }));

      let profile = {
        id: additionalInfo.id,
        GSTnumber: checkData(additionalInfo.GSTnumber),
        PANnumber: checkData(additionalInfo.PANnumber),
        FullName: checkData(additionalInfo.FullName),
        email: checkData(additionalInfo.Email),
        aadharNumber: checkData(additionalInfo.AadharVfid),
        address: checkData(additionalInfo.Address),
        verificationStatus: checkData(additionalInfo.verification_status),
        phone: user.phone,
        profilePic: checkProfileImg(additionalInfo.profilepic), 
        aadharFile:   checkProfileImg(additionalInfo.aadhar),
        businessName: checkData(additionalInfo.businessName),
      }
      // You can include more fields as per your User model
      res.json({ hostDetails, vehicle : processedVehicles, profile });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
};    


//router.put('/profile', authenticate, async (req, res) => {
const updateProfile = async(req , res) => {
    try {
      const hostId = req.user.id;
      const host = await Host.findByPk(hostId);
      if (!host) {
        return res.status(404).json({ message: 'Host not found' });
      }
  
      // Update additional user information
      const { fullName, aadharId, email, address, businessName, GSTnumber, PANnumber, onlyVerifiedUsers } = req.body;
  
      if (fullName || aadharId || email || address || businessName || GSTnumber || PANnumber) {
        await HostAdditional.update({
          FullName: fullName,
          businessName: businessName,
          GSTnumber: GSTnumber,
          PANnumber: PANnumber,
          AadharVfid: aadharId,
          Email: email,
          Address: address,
        }, { where: { id: hostId } });
      }
  
      // Update host's preference for only verified users
      if (onlyVerifiedUsers !== undefined) {
        await host.update({ onlyVerifiedUsers });
      }
  
      res.status(200).json({ message: 'Profile Updated successfully' });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error updating profile', error: error });
    }
  };


const verifyProfileHandler = upload.fields([
  { name: 'aadharFile', maxCount: 1 },
  { name: 'profilePic', maxCount: 1 }
]);

const verifyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { aadharFile, profilePic } = req.files || {};

    if (profilePic && profilePic[0]) {
      await HostAdditional.update(
        { profilepic: profilePic[0].location || null },
        { where: { id: userId } }
      );
    }

    if (aadharFile && aadharFile[0]) {
      await HostAdditional.update(
        { aadhar: aadharFile[0].location || null },
        { where: { id: userId } }
      );
    }

    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating profile', error });
  }
};



module.exports = {hostProfile, updateProfile, verifyProfile, verifyProfileHandler};