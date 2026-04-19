const { Host, Car, User, Listing, Cab, HostAdditional, UserAdditional, Booking, Pricing, Brand, Feedback, carFeature, Feature, Blog, carDevices, Device, Transaction, Driver, DriverAdditional, Vehicle, Bike, VehicleAdditional, HostPayment } = require('../../Models');
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../../s3Config');
const fs = require('fs');
const { Op } = require('sequelize');
const path = require('path');
const noProfileImg = `https://spintrip-s3bucket.s3.ap-south-1.amazonaws.com/vehicleAdditional/no_profile.png`;
const uuid = require('uuid');


const checkStatus = (value) => {
  return value !== null && value !== undefined ? value : 0;
}
const checkData = (value) => {
  return value !== null && value !== undefined && value !== '' ? value : 'Not Provided';
}
const checkProfileImg = (value) => {
  return value !== null && value !== undefined && value.length > 0 ? value[0] : noProfileImg;
}

const checkImage = (value) => {
  return value !== null && value !== undefined && value.length > 0 ? value[0] : null;
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
    
    const userRoleCheck = await User.findByPk(hostId);
    if (userRoleCheck && (userRoleCheck.role === 'Driver' || userRoleCheck.role === 'driver')) {
       return await driverProfile(req, res);
    }
    
    const host = await Host.findByPk(hostId);
    if (!host) {
      const driver = await Driver.findByPk(hostId);
      if (driver) {
         return await driverProfile(req, res);
      }
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
      if (lstg.vehicletype == 3) {
        const cab = await Cab.findOne({ where: { vehicleid: lstg.vehicleid } });
        vehicleModel = cab?.model || null;
        type = cab?.type || null;
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
    let hostDetails = {
      id: host.id,
      onlyVerifiedUsers: host.onlyVerifiedUsers,
      createdAt: host.createdAt,
      updatedAt: host.updatedAt,
      userId: checkData(host.userId),
      parentHostId: checkData(host.parentHostId)
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
    const panFile = additionalInfo.pan ? [additionalInfo.pan] : [];
    
    const hostDriverLookup = await Driver.findOne({ where: { id: hostId } });

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
      profileImage: checkProfileImg(profilePic), // 🔄 Standardized key
      aadhar: checkImage(aadharFile), // 🔄 Single string
      pan: checkImage(panFile), // 🔄 Single string
      businessName: checkData(additionalInfo.businessName),
      upiId: hostDriverLookup ? hostDriverLookup.upiId : null,
      bankAccountNumber: hostDriverLookup ? hostDriverLookup.bankAccountNumber : null,
    }
    // You can include more fields as per your User model
    res.json({ hostDetails, vehicle: processedVehicles, profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const driverProfile = async (req, res) => {
  try {
    const driverId = req.user.id;

    const driver = await Driver.findByPk(driverId);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const user = await User.findByPk(driverId);
    let additionalInfo = await DriverAdditional.findByPk(driverId);

    // 🔄 FALLBACK: If driver-specific info is missing or set to placeholder, check the main UserAdditional table
    if (!additionalInfo || !additionalInfo.AadharVfid || additionalInfo.AadharVfid === 'Not Provided') {
      const userAdd = await UserAdditional.findByPk(driverId);
      if (userAdd) {
        additionalInfo = additionalInfo || {}; 
        additionalInfo.FullName = (additionalInfo.FullName && additionalInfo.FullName !== 'Not Provided') ? additionalInfo.FullName : userAdd.FullName;
        additionalInfo.Email = (additionalInfo.Email && additionalInfo.Email !== 'Not Provided') ? additionalInfo.Email : userAdd.Email;
        additionalInfo.AadharVfid = (additionalInfo.AadharVfid && additionalInfo.AadharVfid !== 'Not Provided') ? additionalInfo.AadharVfid : userAdd.AadharVfid;
        additionalInfo.PanVfid = additionalInfo.PanVfid || userAdd.PanVfid;
        additionalInfo.Address = (additionalInfo.Address && additionalInfo.Address !== 'Not Provided') ? additionalInfo.Address : userAdd.Address;
      }
    }

    const host = driver.hostid
      ? await Host.findByPk(driver.hostid)
      : null;

    const profilePic = additionalInfo?.profilepic
      ? [additionalInfo.profilepic]
      : [];

    const aadharFile = additionalInfo?.aadhar
      ? [additionalInfo.aadhar]
      : [];

    const panFile = additionalInfo?.pan
      ? [additionalInfo.pan]
      : [];

    const profile = {
      id: driver.id,
      fullName: additionalInfo?.FullName || null,
      email: additionalInfo?.Email || null,
      aadharNumber: additionalInfo?.AadharVfid || null,
      address: additionalInfo?.Address || null,
      phone: user?.phone || null,
      profileImage: checkImage(profilePic), // 🔄 Standardized key
      aadhar: checkImage(aadharFile), // 🔄 Single string instead of array
      pan: checkImage(panFile), // 🔄 Single string instead of array
      hostId: driver.hostid || null,
      hostAssigned: !!driver.hostid,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
      upiId: driver.upiId || null,
      bankAccountNumber: driver.bankAccountNumber || null,
      panNumber: additionalInfo?.PanVfid || null, // 🆔 Driver PAN storage
      isActive: driver?.isActive !== undefined ? driver.isActive : false
    };

    res.status(200).json({ profile });

  } catch (error) {
    console.error("driverProfile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
//router.put('/profile', authenticate, async (req, res) => {
const updateProfile = async (req, res) => {
  try {
    const hostId = req.user.id;
    const host = await Host.findByPk(hostId);
    
    // Check if they are a driver
    if (!host) {
      const driver = await Driver.findByPk(hostId);
      if (driver) {
         const { fullName, aadharId, aadharNumber, panNumber, email, address, upiId, bankAccountNumber } = req.body;
         if (fullName || aadharId || aadharNumber || panNumber || email || address) {
            await DriverAdditional.update({
              FullName: fullName,
              AadharVfid: aadharNumber || aadharId,
              PanVfid: panNumber,
              Email: email,
              Address: address,
            }, { where: { id: hostId } });

            // 🔄 SYNC: Also update UserAdditional for consistency in users/profile
            const [userAdditional] = await UserAdditional.findOrCreate({
              where: { id: hostId },
              defaults: { id: hostId }
            });
            await userAdditional.update({
              FullName: fullName,
              AadharVfid: aadharNumber || aadharId,
              PanVfid: panNumber,
              Email: email,
              Address: address,
            });
         }
         
         await Driver.update({ upiId: upiId || null, bankAccountNumber: bankAccountNumber || null }, { where: { id: hostId } });
         
         return res.status(200).json({ message: 'Driver Profile Updated successfully' });
      }
      return res.status(404).json({ message: 'Host not found' });
    }

    // Update additional user information
    const { fullName, aadharId, aadharNumber, panNumber, email, address, businessName, GSTnumber, PANnumber, onlyVerifiedUsers } = req.body;

    if (fullName || aadharId || aadharNumber || panNumber || email || address || businessName || GSTnumber || PANnumber) {
      await HostAdditional.update({
        FullName: fullName,
        businessName: businessName,
        GSTnumber: GSTnumber,
        PANnumber: panNumber || PANnumber,
        AadharVfid: aadharNumber || aadharId,
        Email: email,
        Address: address,
      }, { where: { id: hostId } });
    }

    const { upiId, bankAccountNumber } = req.body;
    const hostDriverRecord = await Driver.findOne({ where: { id: hostId } });
    if (hostDriverRecord) {
       await Driver.update({ upiId: upiId || null, bankAccountNumber: bankAccountNumber || null }, { where: { id: hostId } });
    } else if (upiId || bankAccountNumber) {
       await Driver.create({ id: hostId, hostid: null, upiId: upiId || null, bankAccountNumber: bankAccountNumber || null });
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

// concise postDriver handler
const postDriver = async (req, res) => {
  try {
    const hostId = req.user?.id;
    if (!hostId) return res.status(401).json({ message: 'Unauthorized' });

    const host = await Host.findByPk(hostId);
    if (!host) return res.status(404).json({ message: 'Host not found' });

    const phone = (req.body.phone || '').toString().trim();
    const fullName = (req.body.fullName || '').toString().trim();
    const aadharId = (req.body.aadharId || '').toString().trim();
    const email = (req.body.email || '').toString().trim();
    const address = (req.body.address || '').toString().trim();
    const upiId = (req.body.upiId || '').toString().trim();
    const bankAccountNumber = (req.body.bankAccountNumber || '').toString().trim();

    if (!phone || !fullName) return res.status(400).json({ message: 'phone and fullName required' });

    const existingUser = await User.findOne({ where: { phone } });

    // helper to create/update DriverAdditional
    const upsertAdditional = async (driverId, trx) => {
      const values = {
        id: driverId,
        ...(fullName && { FullName: fullName }),
        ...(aadharId && { AadharVfid: aadharId }),
        ...(email && { Email: email }),
        ...(address && { Address: address }),
      };
      const found = await DriverAdditional.findOne({ where: { id: driverId } });
      if (found) {
        if (Object.keys(values).length > 1) await DriverAdditional.update(values, { where: { id: driverId }, transaction: trx });
        return DriverAdditional.findOne({ where: { id: driverId } });
      }
      // ensure required fields on create
      return DriverAdditional.create({
        id: driverId,
        FullName: fullName || 'Not Provided',
        AadharVfid: aadharId || 'Not Provided',
        Email: email || 'Not Provided',
        Address: address || 'Not Provided',
        profilepic: null,
        aadhar: null
      });
    };

    if (existingUser) {
      const driverRow = await Driver.findOne({ where: { id: existingUser.id } });

      if (driverRow) {

        // If driver exists but is detached, reassign
        if (!driverRow.hostid || upiId || bankAccountNumber) {
          await driverRow.update({ 
            hostid: hostId,
            ...(upiId && { upiId }),
            ...(bankAccountNumber && { bankAccountNumber })
          });
        }

        // If driver belongs to another host (important security check)
        else if (driverRow.hostid !== hostId) {
          return res.status(400).json({
            message: "Driver already assigned to another host"
          });
        }

        await upsertAdditional(existingUser.id, null);

        const updated = await DriverAdditional.findOne({ where: { id: existingUser.id } });

        return res.status(200).json({
          message: "Driver reactivated successfully",
          driver: updated
        });
      }

      await Driver.create({ id: existingUser.id, hostid: hostId, upiId: upiId || null, bankAccountNumber: bankAccountNumber || null });
      await upsertAdditional(existingUser.id);


      const created = await DriverAdditional.findOne({ where: { id: existingUser.id } });
      return res.status(201).json({ message: 'Driver created for existing user', driver: created });
    }

    // new user -> create user, driver, additional
    const userId = uuid.v4();
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('1234', bcrypt.genSaltSync(10));

    await User.create({ id: userId, phone, password: hashedPassword, role: 'driver' });
    await Driver.create({ id: userId, hostid: hostId, upiId: upiId || null, bankAccountNumber: bankAccountNumber || null });
    await DriverAdditional.create({
      id: userId,
      FullName: fullName || 'Not Provided',
      AadharVfid: aadharId || 'Not Provided',
      Email: email || 'Not Provided',
      Address: address || 'Not Provided',
    });

    const driver = await DriverAdditional.findOne({ where: { id: userId } });
    return res.status(201).json({ message: 'Driver created successfully', driver });

  } catch (err) {
    console.error('postDriver error', err);
    return res.status(500).json({ message: 'Error creating driver', error: err.message || err });
  }
};

const deleteDriver = async (req, res) => {
  try {
    const driverId = req.params.id;
    const hostId = req.user.id; // coming from auth middleware
    console.log('Delete driver request', { driverId, hostId });
    const driver = await Driver.findOne({
      where: {
        id: driverId,
        hostid: hostId, // ensures host can delete only their driver
      },
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    await driver.update({
      hostid: null
    });

    return res.status(200).json({
      success: true,
      message: "Driver deleted successfully",
    });

  } catch (error) {
    console.error("Delete driver error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteVendor = async (req, res) => {
  try {
    const vendorId = req.params.id;
    const hostId = req.user.id; // coming from auth middleware
    console.log('Delete vendor request', { vendorId, hostId });
    const vendor = await Host.findOne({
      where: {
        id: vendorId,
        parentHostId: hostId, // ensures host can delete only their vendor
      },
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    await vendor.update({
      parentHostId: null
    });

    return res.status(200).json({
      success: true,
      message: "Vendor deleted successfully",
    });

  } catch (error) {
    console.error("Delete vendor error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


const getAllDrivers = async (req, res) => {
  try {
    const hostId = req.user.id;

    // Validate host
    const host = await Host.findByPk(hostId);
    if (!host) {
      return res.status(404).json({ message: "Host not found" });
    }

    // Fetch drivers belonging to this host with joined info
    const drivers = await Driver.findAll({
      where: { hostid: hostId },
      include: [
        {
          model: User,
          attributes: ["phone", "role", "createdAt"],
        },
        {
          model: DriverAdditional,
          attributes: [
            "FullName",
            "Email",
            "AadharVfid",
            "Address",
            "profilepic",
            "aadhar",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    if (!drivers || drivers.length === 0) {
      return res.status(404).json({ message: "No drivers found for this host." });
    }
    res.status(200).json({
      message: "Drivers fetched successfully",
      count: drivers.length,
      drivers,
    });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    res.status(500).json({ message: "Error fetching drivers", error: error.message });
  }
};


const verifyDriverProfile = async (req, res) => {
  try {
    console.log(req.files);
    const hostId = req.user.id;
    console.log('verifyDriverProfile request', { hostId, body: req.body, files: req.files });
    const host = await Host.findByPk(hostId);
    if (!host) {
      return res.status(404).json({ message: 'Host not found' });
    }
    console.log('verifyDriverProfile request', { hostId, body: req.body.id, files: req.files });
    const driverId = req.body.id;

    if (!driverId) {
      return res.status(400).json({
        message: "Driver id required"
      });
    }

    const driver = await Driver.findOne({
      where: {
        id: driverId,
        hostid: hostId
      }
    });

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found or not assigned to host"
      });
    }



    const { aadharFile, profilePic, dlFile } = req.files || {};

    if (profilePic && profilePic[0]) {
      await DriverAdditional.update(
        { profilepic: profilePic[0].location || null, verification_status: 1 },
        { where: { id: driverId } }
      );
      console.log('Updated driver profile pic', { driverId, profilePic: profilePic[0].location });
    }

    if (dlFile && dlFile[0]) {
      await DriverAdditional.update(
        { dl: dlFile[0].location || null, verification_status: 1 },
        { where: { id: driverId } }
      );
    }

    if (aadharFile && aadharFile[0]) {
      await DriverAdditional.update(
        { aadhar: aadharFile[0].location || null, verification_status: 1 },
        { where: { id: driverId } }
      );
    }

    res.status(200).json({ message: 'Driver profile files uploaded successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error uploading driver profile files', error });
  }
};



const verifyProfileHandler = upload.fields([
  { name: 'aadharFile', maxCount: 1 },
  { name: 'profilePic', maxCount: 1 },
  { name: 'dlFile', maxCount: 1 },
  { name: 'panFile', maxCount: 1 }
]);

const verifyDriverProfileHandler = upload.fields([
  { name: 'aadharFile', maxCount: 1 },
  { name: 'profilePic', maxCount: 1 },
  { name: 'dlFile', maxCount: 1 }
]);
const verifyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(req.files);
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { aadharFile, profilePic, dlFile, panFile } = req.files || {};

    if (user.role === 'Driver' || user.role === 'driver') {
      const [driverAdditional] = await DriverAdditional.findOrCreate({
        where: { id: userId },
        defaults: { id: userId, FullName: 'Not Provided', AadharVfid: 'Not Provided', Email: 'Not Provided', Address: 'Not Provided' }
      });
      if (profilePic && profilePic[0]) await driverAdditional.update({ profilepic: profilePic[0].location, verification_status: 1 });
      if (dlFile && dlFile[0]) await driverAdditional.update({ dl: dlFile[0].location, verification_status: 1 });
      if (aadharFile && aadharFile[0]) await driverAdditional.update({ aadhar: aadharFile[0].location, verification_status: 1 });
      if (panFile && panFile[0]) await driverAdditional.update({ pan: panFile[0].location, verification_status: 1 });
      
      // 🔄 SYNC: Also update UserAdditional for consistency
      const [userAdditional] = await UserAdditional.findOrCreate({ where: { id: userId }, defaults: { id: userId } });
      if (profilePic && profilePic[0]) await userAdditional.update({ profilepic: profilePic[0].location });
      if (dlFile && dlFile[0]) await userAdditional.update({ dl: dlFile[0].location });
      if (aadharFile && aadharFile[0]) await userAdditional.update({ aadhar: aadharFile[0].location });
      if (panFile && panFile[0]) await userAdditional.update({ pan: panFile[0].location, verification_status: 1 });

      return res.status(200).json({ message: 'Driver Profile updated successfully' });
    }

    const [hostAdditional] = await HostAdditional.findOrCreate({
      where: { id: userId },
      defaults: { id: userId }
    });

    if (profilePic && profilePic[0]) {
      await hostAdditional.update({ profilepic: profilePic[0].location || null });
    }

    if (dlFile && dlFile[0]) {
      await hostAdditional.update({ dl: dlFile[0].location || null });
    }

    if (aadharFile && aadharFile[0]) {
      await hostAdditional.update({ aadhar: aadharFile[0].location || null });
    }

    if (panFile && panFile[0]) {
      await hostAdditional.update({ pan: panFile[0].location || null }); // Assuming HostAdditional might also need PAN photo
    }

    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating profile', error });
  }
};

const verifyVendorProfile = async (req, res) => {
  try {
    const hostId = req.user.id;
    console.log('verifyDriverProfile request', { hostId, body: req.body, files: req.files });
    const host = await Host.findByPk(hostId);
    if (!host) {
      return res.status(404).json({ message: 'Host not found' });
    }
    console.log('verifyDriverProfile request', { hostId, body: req.body.id, files: req.files });
    const vendorId = req.body.id;

    if (!vendorId) {
      return res.status(400).json({
        message: "Vendor id required"
      });
    }

    const vendor = await Host.findOne({
      where: {
        id: vendorId,
        parentHostId: hostId
      }
    });

    if (!vendor) {
      return res.status(404).json({
        message: "Vendor not found or not assigned to host"
      });
    }



    const { aadharFile, profilePic } = req.files || {};

    if (profilePic && profilePic[0]) {
      await HostAdditional.update(
        { profilepic: profilePic[0].location || null },
        { where: { id: vendorId } }
      );
      console.log('Updated vendor profile pic', { vendorId, profilePic: profilePic[0].location });
    }

    if (aadharFile && aadharFile[0]) {
      await HostAdditional.update(
        { aadhar: aadharFile[0].location || null },
        { where: { id: vendorId } }
      );
    }

    console.log('Vendor profile updated', { vendorId });

    res.status(200).json({ message: 'Vendor profile files uploaded successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error uploading vendor profile files', error });
  }
};


module.exports = { hostProfile, updateProfile, verifyProfile, verifyProfileHandler, deleteDriver, deleteVendor,postDriver, verifyDriverProfile, getAllDrivers, verifyDriverProfileHandler, verifyVendorProfile };