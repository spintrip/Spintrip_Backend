const { Host, Car, User, Listing, HostAdditional, UserAdditional, Booking, Pricing, Brand, Feedback, carFeature, Feature, Blog, carDevices, Device, Transaction, Vehicle, Bike, VehicleAdditional, HostPayment } = require('../../Models');
const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const axios = require('axios');



const generateOTP = () => {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    return otp;
  };
  
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
// Host Signup
// router.post('/signup', async (req, res) => {
const hostSignup = async (req, res) => {
    var phone = req.body.phone;
    var password = req.body.password;
    try {
      const bcrypt = require("bcrypt");
      const salt = bcrypt.genSaltSync(10);
      // const hashedPassword = bcrypt.hashSync("my-password", salt);
      const hashedPassword = await bcrypt.hash(password, salt);
      const userId = uuid.v4();
      const user1 = await User.findOne({ where: { phone:phone } });
      if (user1) {
        const host1 = await Host.findOne({ where: { id: user1.id } });
        if(host1){
        return res.status(404).json({ message: 'Host Already exists' });
        }
      }
      
      const user = await User.create({ id: userId, phone, password: hashedPassword, role: 'Host' });
      const host = await Host.create({
        id: user.id,
      });
      HostAdditional.create({ id: user.id });
      let response = {
        id: user.id,
        phone: user.phone,
        role: user.role,
      }
      res.status(201).json({ message: 'Host created', response });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error creating host' });
    }
  };

  // Host Login
// router.post('/login', authenticate, async (req, res) => {
const hostLogin = async(req, res) => {
    const { phone, password } = req.body;
    try {
      const user = await User.findOne({ where: { phone } });
      const host = await Host.findOne({ where: { id: user.id } });
  
      if (!host) {
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
  
  //Verify-Otp
  //router.post('/verify-otp', async (req, res) => {
const hostVerifyOtp = async(req , res) =>{
    const { phone, otp } = req.body;
    const user = await User.findOne({ where: { phone } })
    if (!user) {
      return res.status(401).json({ message: 'Invalid Phone' });
    }
    const fixed_otp = user.otp;
    if (fixed_otp === otp) {
      const user = await User.findOne({ where: { phone } });
      const token = jwt.sign({ id: user.id, role: 'host' }, 'your_secret_key');
      return res.json({ message: 'OTP verified successfully', id: user.id, token });
    } else {
      return res.status(401).json({ message: 'Invalid OTP' });
    }
  };

  // Delete Host 
  const deleteHost = async(req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'Host not found' });
      }
      const host = await Host.findByPk(req.user.id);
      if(!host){
        return res.status(404).json({ message: 'Host not found' });
      }
      
      await user.destroy();
      res.status(200).json({ message: 'Host deleted successfully' });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error deleting user', error });
    }
  };

module.exports = {hostSignup, hostLogin, hostVerifyOtp, deleteHost};