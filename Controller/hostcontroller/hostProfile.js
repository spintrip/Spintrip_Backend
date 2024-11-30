const { Host, Car, User, Listing, HostAdditional, UserAdditional, Booking, Pricing, Brand, Feedback, carFeature, Feature, Blog, carDevices, Device, Transaction, Vehicle, Bike, VehicleAdditional, HostPayment } = require('../../Models');
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../../s3Config');
const fs = require('fs');
const path = require('path');



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
      let additionalInfo = await HostAdditional.findByPk(hostId);
      console.log(additionalInfo);
      let profile = {
        id: additionalInfo.id,
        GSTnumber: additionalInfo.GSTnumber,
        PANnumber: additionalInfo.PANnumber,
        FullName: additionalInfo.FullName,
        email: additionalInfo.Email,
        aadharNumber: additionalInfo.AadharVfid,
        address: additionalInfo.Address,
        verificationStatus: additionalInfo.verification_status,
        phone: user.phone,
        profilePic: additionalInfo.profilepic, 
        aadharFile:   additionalInfo.aadhar,
        businessName: additionalInfo.businessName,
      }
      // You can include more fields as per your User model
      res.json({ hostDetails: host, vehicle, profile });
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

// Put Verify
//router.put('/verify', authenticate, upload.fields([{ name: 'aadharFile', maxCount: 1 },{ name: 'profilePic', maxCount: 1 }]), async (req, res) => {
//     const verifyProfile = upload.fields([{ name: 'aadharFile', maxCount: 1 },{ name: 'profilePic', maxCount: 1 }]), async(req, res) => {
//     try {
//       const userId = req.user.id;
//       const user = await User.findByPk(userId);
//       if (!user) {
//         return res.status(404).json({ message: 'User not found' });
//       }
  
//       let files = [];
//       if (req.files) {
//         if (req.files['aadharFile']) files.push(req.files['aadharFile'][0]);
//         if (req.files['profilePic']) files.push(req.files['profilePic'][0]);
//       }
//       const { profilePic, aadharFile } = req.files;
//       console.log(profilePic);
//       if (profilePic) {
//         await HostAdditional.update({
//           profilepic: profilePic ? profilePic[0].location : null,
//         }, { where: { id: userId } });
//       }
  
//       if (aadharFile) {
//         await HostAdditional.update({
//           aadhar: aadharFile ? aadharFile[0].location : null,
//         }, { where: { id: userId } });
//         console.log(aadharFile)
//       }
//       res.status(200).json({ message: 'Profile Updated successfully' });
//     } catch (error) {
//       console.log(error);
//       res.status(500).json({ message: 'Error updating profile', error: error });
//     }
//   };

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