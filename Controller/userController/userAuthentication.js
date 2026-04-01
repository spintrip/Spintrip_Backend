//importing modules
const bcrypt = require("bcrypt");
const axios = require('axios');
const { User, Wallet, WalletTransaction, ReferralReward, Vehicle, Chat, UserAdditional, Listing, sequelize, Booking, Pricing,
  carFeature, Feedback, Host, Tax, Wishlist, Feature, Blog, Bike, Car, HostAdditional, VehicleAdditional, BookingExtension, Transaction } = require('../../Models');
const uuid = require('uuid');
const { generateToken } = require('../../Middleware/authMiddleware');


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
const generateOTP = () => {
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  return otp;
};


//signing a user up
//hashing users password before its saved to the database with bcrypt
const signup = async (req, res) => {
  // 🎫 Normalizing for both 'referCode' and 'referredByCode'
  const { phone, password, role, referCode, referredByCode } = req.body;
  const finalReferCode = (referCode || referredByCode || "").trim().toUpperCase();

  const t = await sequelize.transaction();

  try {
    // 1. Role validation
    if (!['user', 'host', 'admin'].includes(role)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid role' });
    }

    // 2. DUPLICATE CHECK: Prevent multiple sign-ups with the same phone number
    const existingUser = await User.findOne({ where: { phone }, transaction: t });
    if (existingUser) {
      await t.rollback();
      return res.status(409).json({ message: 'User with this phone number already exists. Please login.' });
    }

    // 3. Security Check
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userId = uuid.v4();
    
    // 🎫 Generate this new user's personal referral code (A1B29876 format)
    const myPersonalCode = Math.random().toString(36).substring(2, 6).toUpperCase() + phone.slice(-4);

    let referredById = null;
    let refereeBonus = 0;

    // 4. REFERRAL REWARD: Award the Inviter (Referrer)
    if (finalReferCode) {
      const referrer = await User.findOne({ 
        where: { referralCode: finalReferCode },
        include: [{ model: Wallet }],
        transaction: t 
      });
      
      if (referrer) {
        if (referrer.referralCount < 50) {
          referredById = referrer.id;
          
          // 🪙 Reward the Referrer (+100 Gold Coins)
          const referrerWallet = referrer.Wallet || await Wallet.create({ id: uuid.v4(), userId: referrer.id, balance: 0 }, { transaction: t });
          await referrerWallet.increment('balance', { by: 100.0, transaction: t });
          
          await WalletTransaction.create({
            id: uuid.v4(),
            walletId: referrerWallet.id,
            amount: 100.0,
            type: 'CREDIT',
            description: 'Referral Reward: Gold Coins (Friend Joined)',
            referenceId: userId
          }, { transaction: t });

          // Increment history count for limit tracking
          await User.increment('referralCount', { by: 1, where: { id: referredById }, transaction: t });
          
          // 🎁 Reward the NEW user (Referee) with their first ₹100 Gold Coins
          refereeBonus = 100.0;
        } else {
          console.log(`Referrer ${referrer.id} has already reached the 50-referral limit.`);
        }
      }
    }

    // 5. UNIFIED CREATION: Ensure everyone gets a base User record with their personal code
    const newUser = await User.create({
      id: userId,
      phone,
      password: hashedPassword,
      role: role === 'host' ? 'host' : (role === 'admin' ? 'admin' : 'user'),
      referralCode: myPersonalCode,
      referredBy: referredById,
      referralCount: 0 // This tracks number of users brought IN, not coins
    }, { transaction: t });

    // 6. Role-specific records
    if (role === 'host') {
      await Host.create({ id: userId, phone, parentHostId: null }, { transaction: t });
    } else if (role === 'admin') {
      await Admin.create({ id: userId, phone }, { transaction: t });
    }

    // Initialize Profile Storage
    await UserAdditional.create({ id: userId }, { transaction: t });

    // 💳 INITIALIZE WALLET for ALL new users
    const userWallet = await Wallet.create({ 
      id: uuid.v4(), 
      userId: userId, 
      balance: refereeBonus 
    }, { transaction: t });

    if (refereeBonus > 0) {
      await WalletTransaction.create({
        id: uuid.v4(),
        walletId: userWallet.id,
        amount: refereeBonus,
        type: 'CREDIT',
        description: 'Welcome Reward: Gold Coins (Referral Applied)',
        referenceId: 'welcome'
      }, { transaction: t });
    }

    await t.commit();

    let responseData = {
      id: newUser.id,
      phone: newUser.phone,
      role: newUser.role,
      referralCode: newUser.referralCode,
      referralCount: newUser.referralCount,
      walletBalance: refereeBonus
    }

    res.status(201).json({ message: 'User created successfully', response: responseData });
  } catch (error) {
    if (t) await t.rollback();
    console.error('Signup Error:', error);
    res.status(500).json({ message: 'Error creating user', error: error.message });
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
  return res.json({ message: 'OTP sent successfully', redirectTo: '/verify-otp', otp: otp });
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
    const userAdditional = await UserAdditional.findOne({ where: { id: user.id } });

    let isNewUser = false;
    if (!userAdditional || !userAdditional.FullName || !userAdditional.Email || userAdditional.FullName === "Not Provided" || userAdditional.FullName === "") {
      isNewUser = true;
    }

    const token = generateToken(user);
    const id = user.id;

    return res.json({ message: 'OTP verified successfully', id, token, isNewUser });
  } else {
    return res.status(401).json({ message: 'Invalid OTP' });
  }
}

module.exports = { signup, login, verify };
