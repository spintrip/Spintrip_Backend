const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { User, Host, Admin, Driver } = require('../Models'); // Adjust the path if needed

const SECRET_KEY = 'your_secret_key';

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, SECRET_KEY);
};

// Authenticate Middleware
const authenticate = async (req, res, next) => {
  const token = req.header('token');

  if (token) {
    try {
      // Verify Token
      const decodedToken = jwt.verify(token, SECRET_KEY);

      if (decodedToken.role === 'driver') {
        // Handle Driver Role
        const driver = await Driver.findOne({ where: { id: decodedToken.id } });
        if (!driver) {
          return res.status(401).json({ message: 'Driver not found or unauthorized' });
        }

        req.user = { ...driver.dataValues, userid: driver.id, role: 'driver' };
      } else {
        // Handle User, Host, or Admin
        const user = await User.findOne({ where: { id: decodedToken.id } });
        if (!user) {
          return res.status(401).json({ message: 'User not found or unauthorized' });
        }

        req.user = { ...user.dataValues, userid: user.id, role: decodedToken.role };
      }

      console.log(`${decodedToken.role} is logged in`);
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  } else {
    // Fallback to Phone and Password Authentication
    const { phone, password } = req.body;

    try {
      // Handle Driver Login
      const driver = await Driver.findOne({ where: { phone } });
      if (driver) {
        if (password !== '1234') {
          return res.status(401).json({ message: 'Invalid phone or password for driver' });
        }

        // Allow specific driver routes: `/cab` or `/host/cab`
        if (!req.originalUrl.startsWith('/cab') && !req.originalUrl.startsWith('/host/cab')) {
          return res.status(403).json({ message: 'Access denied for drivers on this route' });
        }

        req.user = { ...driver.dataValues, userid: driver.id, role: 'driver' };
        next();
        return;
      }

      // Handle User, Host, or Admin Login
      const user = await User.findOne({ where: { phone } });
      if (!user) {
        return res.status(401).json({ message: 'Invalid phone or password' });
      }

      const isPasswordValid = bcrypt.compareSync(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid phone or password' });
      }

      const host = await Host.findOne({ where: { id: user.id } });
      const admin = await Admin.findOne({ where: { id: user.id } });

      let role = 'user';
      if (host) {
        role = 'host';
      } else if (admin) {
        role = 'admin';
      }

      req.user = { ...user.dataValues, userid: user.id, role };
      next();
    } catch (error) {
      return res.status(500).json({ message: 'Server error' });
    }
  }
};

// Signup Function
const signup = async (req, res) => {
  const { phone, password = '1234', role } = req.body; // Default password as 1234

  try {
    // Input validation
    if (!phone || !role) {
      return res.status(400).json({ message: 'Phone and role are required' });
    }

    // Check for existing user or driver with the same phone
    const existingUser = await User.findOne({ where: { phone } });
    const existingDriver = await Driver.findOne({ where: { phone } });

    if (existingUser || existingDriver) {
      return res.status(400).json({ message: 'User with this phone already exists' });
    }

    let user;

    // Handle different roles
    switch (role) {
      case 'user':
        user = await User.create({
          phone,
          password: await bcrypt.hash(password, 10),
        });
        break;
      case 'host':
        user = await Host.create({
          phone,
          password: await bcrypt.hash(password, 10),
        });
        break;
      case 'admin':
        user = await Admin.create({
          phone,
          password: await bcrypt.hash(password, 10),
        });
        break;
      case 'driver':
        user = await Driver.create({
          phone,
          password, // Plain text for drivers, to align with OTP-based verification
        });
        break;
      default:
        return res.status(400).json({ message: 'Invalid role' });
    }

    const token = generateToken({ id: user.id, role });
    res.status(201).json({ message: `${role} created`, user, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

module.exports = {
  authenticate,
  signup,
  generateToken,
};
