//importing modules
const bcrypt = require("bcrypt");
const axios = require('axios');
const { User, Vehicle, Chat, UserAdditional, Listing, sequelize, Booking, Pricing,
  carFeature, Feedback, Host, Tax, Wishlist, Feature, Blog, Bike, Car, HostAdditional, VehicleAdditional, BookingExtension, Transaction } = require('../../Models');
const uuid = require('uuid');
const { generateToken } = require('../../Middleware/authMiddleware');


const sendOTP = async(phone, otp) => {
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
  const generateOTP = () => {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    return otp;
  };


   //signing a user up
  //hashing users password before its saved to the database with bcrypt
  const signup = async (req, res) => {
    const { phone, password, role } = req.body;
  
    try {
      // Check if the provided role is valid
      if (!['user', 'host', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
  
      // Hash the password
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = await bcrypt.hash(password, salt);
  
      const userId = uuid.v4();
      let user;
      // Create user based on the role
      if (role === 'user') {
        user = await User.create({ id: userId, phone, password: hashedPassword, role: 'user' });
      } else if (role === 'host') {
        user = await Host.create({ id: userId, phone, password: hashedPassword, role: 'host' });
      } else if (role === 'admin') {
        user = await Admin.create({ id: userId, phone, password: hashedPassword, role: 'admin' });
      }
      let response = {
        id: user.id,
        phone: user.phone,
        role: user.role,
      }
  
      UserAdditional.create({ id: user.id });
      // Respond with success message
      res.status(201).json({ message: 'User created', response });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error creating user' });
    }
  }

  const login = async (req, res) => {
    const { phone } = req.body;
    const user = await User.findOne({ where: { phone } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (phone == '+911234567890') {
      return res.status(201).json({ message: 'OTP sent successfully', redirectTo: '/verify-otp', phone, otp: user.otp });
    }
    // Generate OTP
    const otp = generateOTP();
    // Send OTP to the user's phone
    sendOTP(phone, otp);
    await user.update({ otp: otp })
    // Redirect to verify OTP route
    return res.json({ message: 'OTP sent successfully', redirectTo: '/verify-otp', otp:otp });
  };
  
  const verify = async (req, res) => {
    const { phone, otp } = req.body;
    const user = await User.findOne({ where: { phone } })
    if (!user) {
      return res.status(401).json({ message: 'Invalid OTP' });
    }
    const fixed_otp = user.otp;
    if (fixed_otp === otp) {
      const user = await User.findOne({ where: { phone } });
      const token = generateToken(user);
      const id = user.id;
  
      return res.json({ message: 'OTP verified successfully', id, token });
    } else {
      return res.status(401).json({ message: 'Invalid OTP' });
    }
  }

  module.exports = {signup , login, verify} ;
 