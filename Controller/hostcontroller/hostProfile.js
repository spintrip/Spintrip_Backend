const { Host, Car, User, Listing, HostAdditional, UserAdditional, Booking, Pricing, Brand, Feedback, carFeature, Feature, Blog, carDevices, Device, Transaction, Vehicle, Bike, VehicleAdditional, HostPayment } = require('../../Models');
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../../s3Config');
const fs = require('fs');
const path = require('path');
const noProfileImg = `https://spintrip-s3bucket.s3.ap-south-1.amazonaws.com/vehicleAdditional/no_profile.png`;


const checkStatus = (value) => {
  return value !== null && value !== undefined ? value : 0;
}
const checkData = (value) => {
  return value !== null && value !== undefined ? value : 'Not Provided';
}
const checkProfileImg = (value) => {
  return value !== null && value !== undefined ? value : noProfileImg;
}

const profileImageStorage = multerS3({
  s3: s3,
  bucket: 'spintrip-s3bucket',
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
const hostProfile = async (req, res) => {
  try {
    const hostId = req.user.id;
    const host = await Host.findByPk(hostId);
    if (!host) {
      return res.status(404).json({ message: 'Host not found' });
    }
    const user = await User.findOne({ where: { id: hostId } });
    const vehicles = await Vehicle.findAll({ where: { hostId: host.id } });

    const processedVehicles = [];
    for (const lstg of vehicles) {
      let vehicleModel = null;
      let type = null;
      if (lstg.vehicletype == 2) {  
        const car = await Car.findOne({ where: { vehicleid: lstg.vehicleid } });
        vehicleModel = car?.carmodel || null;
        type = car?.type || null;
      }
      if (lstg.vehicletype == 1) {  
        const bike = await Bike.findOne({ where: { vehicleid: lstg.vehicleid } });
        vehicleModel = bike?.bikemodel || null;
        type = bike?.type || null;
      }

      processedVehicles.push({
        vehicleid: checkData(lstg?.vehicleid),
        vehicletype: checkData(lstg?.vehicletype),
        type: type,
        chassisno: checkData(lstg?.chassisno),
        Rcnumber: checkData(lstg?.Rcnumber),
        Enginenumber: checkData(lstg?.Enginenumber),
        Registrationyear: checkData(lstg?.Registrationyear),
        timestamp: checkData(lstg?.timestamp),
        rating: checkData(lstg?.rating),
        activated: checkData(lstg?.activated),
        hostId: checkData(lstg?.hostId),
        createdAt: checkData(lstg?.createdAt),
        updatedAt: checkData(lstg?.updatedAt),
        vehicleModel: checkData(vehicleModel)  // <-- Here we add vehicleModel
      });
    }
    let additionalInfo = await HostAdditional.findByPk(hostId);
    console.log(additionalInfo);
    let hostDetails = {
      id: host.id,
      onlyVerifiedUsers: host.onlyVerifiedUsers,
      createdAt: host.createdAt,
      updatedAt: host.updatedAt,
      userId: checkData(host.userId)
    }

    // const processedVehicles = vehicle.map((vehicleDetail) => ({
    //   vehicleid: checkData(vehicleDetail?.vehicleid),
    //   vehicletype: checkData(vehicleDetail?.vehicletype),
    //   chassisno: checkData(vehicleDetail?.chassisno),
    //   Rcnumber: checkData(vehicleDetail?.Rcnumber),
    //   Enginenumber: checkData(vehicleDetail?.Enginenumber),
    //   Registrationyear: checkData(vehicleDetail?.Registrationyear),
    //   timestamp: checkData(vehicleDetail?.timestamp),
    //   rating: checkData(vehicleDetail?.rating),
    //   activated: checkData(vehicleDetail?.activated),
    //   hostId: checkData(vehicleDetail?.hostId),
    //   createdAt: checkData(vehicleDetail?.createdAt),
    //   updatedAt: checkData(vehicleDetail?.updatedAt),
    // }));
    const aadharFile = additionalInfo.aadhar ? [additionalInfo.aadhar] : [];
    const profilePic = additionalInfo.profilepic ? [additionalInfo.profilepic] : [];
    let profile = {
      id: additionalInfo.id,
      GSTnumber: checkData(additionalInfo.GSTnumber),
      PANnumber: checkData(additionalInfo.PANnumber),
      FullName: checkData(additionalInfo.FullName),
      email: checkData(additionalInfo.Email),
      aadharNumber: checkData(additionalInfo.AadharVfid),
      address: checkData(additionalInfo.Address),
      verificationStatus: checkStatus(additionalInfo.verification_status),
      phone: user.phone,
      profilePic: checkProfileImg(profilePic),
      aadhar: checkProfileImg(aadharFile),
      businessName: checkData(additionalInfo.businessName),
    }
    // You can include more fields as per your User model
    res.json({ hostDetails, vehicle: processedVehicles, profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


//router.put('/profile', authenticate, async (req, res) => {
const updateProfile = async (req, res) => {
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



module.exports = { hostProfile, updateProfile, verifyProfile, verifyProfileHandler };