const { Host, Car, User, Driver, Listing, HostAdditional, UserAdditional, DriverAdditional, Booking, Pricing, Brand, Feedback, carFeature, Feature, Blog, carDevices, Device, Transaction, Vehicle, Bike, VehicleAdditional, HostPayment } = require('../../Models');
const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const axios = require('axios');
const { where } = require('sequelize');



const generateOTP = () => {
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  return otp;
};

const sendOTP = async (phone, otp) => {
  console.log(`Sending OTP ${otp} to phone number ${phone}`);
  const url = `https://2factor.in/API/V1/${process.env.SMS_API_KEY}/SMS/${phone}//${otp}/`;
  try {
    const response = await axios.get(url);
    console.log('OTP sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending OTP:', error);
  }
};
// Host Signup
// router.post('/signup', async (req, res) => {
const hostSignup = async (req, res) => {

  const { phone, password, hostType } = req.body;

  try {

    const bcrypt = require("bcrypt");
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userId = uuid.v4();

    const existingUser = await User.findOne({ where: { phone } });

    if (existingUser) {

      const driver = await Driver.findOne({ where: { id: existingUser.id } });
      if (driver) {
        return res.status(400).json({ message: "Driver already exists" });
      }

      const host = await Host.findOne({ where: { id: existingUser.id } });
      if (host) {
        return res.status(400).json({ message: "Host already exists" });
      }

    }

    // create user first
    const user = await User.create({
      id: userId,
      phone,
      password: hashedPassword,
      role: hostType
    });

    // DRIVER FLOW
    if (hostType === "Driver") {

      await Driver.create({
        id: user.id,
        hostid: null // will be assigned later by vendor
      });

      await DriverAdditional.create({
        id: user.id,
        FullName: "Not Provided",
        AadharVfid: "Not Provided",
        Email: "Not Provided",
        Address: "Not Provided",
        profilepic: null,
        aadhar: null
      });

      return res.status(201).json({
        message: "Driver created",
        response: {
          id: user.id,
          phone: user.phone,
          role: "driver"
        }
      });

    }

    // HOST / SUPERHOST FLOW
    await Host.create({
      id: user.id
    });

    await HostAdditional.create({
      id: user.id
    });

    return res.status(201).json({
      message: "Host created",
      response: {
        id: user.id,
        phone: user.phone,
        role: hostType
      }
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Error creating host",
      error: error.message
    });

  }
};

// Host Login
// router.post('/login', authenticate, async (req, res) => {
const hostLogin = async (req, res) => {
  const { phone, password } = req.body;
  try {
    const user = await User.findOne({ where: { phone } });
    const host = await Host.findOne({ where: { id: user.id } });
    const driver = await Driver.findOne({ where: { id: user.id } });
    if (!host && !driver) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }
    if (phone == '+910123456789') {
      return res.status(201).json({ message: 'OTP sent successfully', redirectTo: '/verify-otp', phone, otp: user.otp });
    }
    const otp = await generateOTP();
    await sendOTP(phone, otp);
    await user.update({ otp: otp })
    return res.json({ message: 'OTP sent successfully', redirectTo: '/verify-otp', otp: otp });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const addVendor = async (req, res) => {
  try {

    const superHostId = req.user.id;
    const { fullName, phone, address, aadharId, email, password } = req.body;
    const bcrypt = require("bcrypt");
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const superHost = await Host.findOne({
      where: { id: superHostId }
    });

    if (!superHost) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Only allow superhost
    if (superHost.parentHostId !== null) {
      return res.status(403).json({
        message: "Only superhost can add vendors"
      });
    }

    const vendorId = uuid.v4();
    const user1 = await User.findOne({ where: { phone: phone } });
    if (user1) {
      const host1 = await Host.findOne({ where: { id: user1.id } });
      if (host1) {
        await Host.update(
          { parentHostId: superHostId },
          { where: { id: user1.id } }
        );
        return res.status(200).json({ message: 'Host Already exists', id: host1.id });

      }
    }
    else {
      const user = await User.create({ id: vendorId, phone, password: hashedPassword, role: 'Host' });
      const host = await Host.create({
        id: user.id,
        parentHostId: superHostId
      });
      await HostAdditional.create({
        id: user.id,
        FullName: fullName,
        Email: email,
        Address: address,
        AadharVfid: aadharId
      });
    }

    res.status(201).json({
      message: "Vendor created successfully",
      vendor: {
        id: vendorId, 
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating vendor" });
  }
};


const getChildHosts = async (req, res) => {
  try {

    const superHostId = req.user.id;

    const childHosts = await Host.findAll({
      where: { parentHostId: superHostId },
      include: [
        {
          model: HostAdditional,
          attributes: ["FullName", "Email", "profilepic"]
        },
        {
          model: User,
          attributes: ["phone"]
        }
      ]
    });

    const formattedHosts = childHosts.map(host => ({
      id: host.id,
      name: host.HostAdditional?.FullName,
      email: host.HostAdditional?.Email,
      phone: host.User?.phone,
      profilePic: host.HostAdditional?.profilepic
    }));

    res.status(200).json({
      vendors: formattedHosts
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error fetching vendors"
    });
  }
};
//Verify-Otp
//router.post('/verify-otp', async (req, res) => {
const hostVerifyOtp = async (req, res) => {
  const { phone, otp } = req.body;
  const user = await User.findOne({ where: { phone } })
  if (!user) {
    return res.status(401).json({ message: 'Invalid Phone' });
  }
  const driver = await Driver.findOne({ where: { id: user.id } });
  const fixed_otp = user.otp;
  if (fixed_otp === otp) {
    const user = await User.findOne({ where: { phone } });
    
    let isNewUser = false;
    if (user.role === 'driver' || user.role === 'Driver') {
      const driverAdditional = await DriverAdditional.findOne({ where: { id: user.id } });
      if (!driverAdditional || !driverAdditional.FullName || !driverAdditional.AadharVfid || driverAdditional.FullName === "Not Provided" || driverAdditional.FullName === "") {
        isNewUser = true;
      }
    } else {
      const hostAdditional = await HostAdditional.findOne({ where: { id: user.id } });
      if (!hostAdditional || !hostAdditional.FullName || !hostAdditional.Email || hostAdditional.FullName === "Not Provided" || hostAdditional.FullName === "") {
        isNewUser = true;
      }
    }

    const token = jwt.sign({ id: user.id, role: 'host' }, 'your_secret_key');
    return res.json({ message: 'OTP verified successfully', id: user.id, token, role: user.role, isNewUser });
  } else {
    return res.status(401).json({ message: 'Invalid OTP' });
  }
};

// Delete Host 
const deleteHost = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Host not found' });
    }
    const host = await Host.findByPk(req.user.id);
    if (!host) {
      return res.status(404).json({ message: 'Host not found' });
    }

    await user.destroy();
    res.status(200).json({ message: 'Host deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting user', error });
  }
};

module.exports = { hostSignup, hostLogin, hostVerifyOtp, deleteHost, addVendor, getChildHosts };