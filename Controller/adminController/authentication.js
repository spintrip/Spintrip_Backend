const { Admin } = require('../../Models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const generateOTP = () => {
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  return otp;
};

const sendOTP = (phone, otp) => {
  console.log(`Sending OTP ${otp} to phone number ${phone}`);
};

const adminLogin = async (req, res) => {
  // Functionality here
};

const verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await Admin.findOne({ where: { id: req.user.id } });

    const fixed_otp = user.otp;
    if (fixed_otp === otp) {
      const token = jwt.sign({ id: user.id, role: 'admin' }, 'your_secret_key');
      return res.json({ message: 'OTP verified successfully', user, token });
    } else {
      return res.status(401).json({ message: 'Invalid OTP' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error', error });
  }
};

module.exports = { adminLogin, verifyOTP };