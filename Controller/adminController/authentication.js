const { Admin, User, UserAdditional } = require('../../Models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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
const adminSignup = async (req, res) =>{
  const { phone, password, securityQuestion } = req.body;

  try {
    const user = await User.findOne({ where: { phone } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const admin1 = await Admin.findOne({ where: { id: user.id } });

    if (admin1) {
      return res.status(404).json({ message: 'Admin Already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the Admin table with the user's ID and other properties
    const admin = await Admin.create({
      id: user.id, // Link to the user in the User table
      securityQuestion,
      timestamp: new Date(), // Set the current timestamp
      password: hashedPassword,
      UserId: user.id,
      role: 'Admin'
    });

    res.status(201).json({ message: 'Admin created', admin });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating admin' });
  }
};

const adminLogin = async (req, res) => {
  try{
  const { phone } = req.body;
  const user = await User.findOne({ where: { phone } });
  const admin = await Admin.findOne({ where: { id: user.id } });
  if (!admin) {
    return res.status(401).json({ message: 'Invalid phone number' });
  }
  const otp = generateOTP();
  sendOTP(phone, otp);
  await user.update({ otp: otp })
  return res.json({ message: 'OTP sent successfully', redirectTo: '/verify-otp', phone, otp });
} catch (error) {
  console.log(error);
  res.status(500).json({ message: 'Error logging in', error });
}};

const verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const admin = await User.findOne( { where: { phone: phone } })
    if(!admin){
      return res.status(404).json({ message: 'User doesnt exist' });
    }
    const user = await Admin.findOne({ where: { id: admin.id } });
    if(!user){
      return res.status(404).json({ message: 'Admin doesnt exist' });
    }
    const fixed_otp = admin.otp;
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

const adminProfile = async (req, res)  => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const additionalinfo = await UserAdditional.findByPk(adminId)

    res.json({ phone: admin.phone, securityQuestion: admin.SecurityQuestion, additionalinfo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error });
  }
}

module.exports = { adminLogin, verifyOTP, adminSignup, adminProfile };