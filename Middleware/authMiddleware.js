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
      console.log('Decoded Token:', decodedToken);
      const user = await User.findByPk(decodedToken.id);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      let role = user.role;

      // Validate host
      if (role === "host" || role === "superhost") {

        const host = await Host.findOne({ where: { id: user.id } });

        if (!host) {
          return res.status(401).json({ message: "Host not found" });
        }

      }

      // Validate driver
      if (role === "Driver") {

        const driver = await Driver.findOne({ where: { id: user.id } });

        if (!driver) {
          return res.status(401).json({ message: "Driver not found" });
        }

        

      }

      let adminRoleMetadata = undefined;
      
      // If role is admin, dynamically fetch from the DB to support legacy tokens missing adminRole
      if (role === "admin") {
        const adminData = await Admin.findOne({ where: { id: user.id } });
        if (adminData) {
          adminRoleMetadata = adminData.adminRole || 'superadmin';
        }
      }

      // Attach user to request (Now capturing adminRole correctly)
      req.user = {
        ...user.dataValues, 
        userid: user.id, 
        role: decodedToken.role, 
        adminRole: decodedToken.adminRole || adminRoleMetadata 
      };

      console.log(`${role} authenticated`);

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  } else {
    // Fallback to Phone and Password Authentication
    const { phone, password } = req.body;

    try {
      // Handle Driver Login
      // const driver = await Driver.findOne({ where: { phone } });
      // if (driver) {
      //   if (password !== '1234') {
      //     return res.status(401).json({ message: 'Invalid phone or password for driver' });
      //   }

      //   // Allow specific driver routes: `/cab` or `/host/cab`
      //   if (!req.originalUrl.startsWith('/cab') && !req.originalUrl.startsWith('/host/cab')) {
      //     return res.status(403).json({ message: 'Access denied for drivers on this route' });
      //   }

      //   req.user = { ...driver.dataValues, userid: driver.id, role: 'driver' };
      //   next();
      //   return;
      // }

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
      const existingDriver = await Driver.findOne({ where: { id: user.id } });

      let role = 'user';
      if (host) {
        console.log('Host logged in');
        role = 'host';
      } else if (admin) {
        role = 'admin';
        // Add adminRole to req.user for non-jwt fallback logic (though mostly jwt is used)
        req.user = { ...user.dataValues, userid: user.id, role, adminRole: admin.adminRole || 'superadmin' };
        return next();
      } else if (existingDriver) {
        role = 'Driver';
      }

      req.user = { ...user.dataValues, userid: user.id, role };
      next();
    } catch (error) {
      return res.status(500).json({ message: 'Server error' });
    }
  }
};

// RBAC Middleware for Superadmin exclusive routes
const restrictToSuperadmin = (req, res, next) => {
  // STRICT FIREWALL: Reject absolutely anyone who is not an admin
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: You must be an Administrator to access this resource.' });
  }
  
  // Debug injection
  res.setHeader('X-Debug-Role', req.user.adminRole || 'undefined');

  // Normalize admin role casing (handling SUPER_ADMIN, SUPERADMIN, superadmin)
  const normalizedRole = (req.user.adminRole || '').toLowerCase().replace('_', '');

  // Standard superadmin gets full access
  if (normalizedRole === 'superadmin' || normalizedRole === 'admin') {
    return next();
  }

  // Cab Admin (Super Host) gets restricted access
  if (normalizedRole === 'cabadmin') {
    
    // Allow specific endpoints explicitly built for Cabs (if applicable)
    // and generic CRUD for cab-specific tables.
    const allowedCabModels = [
      'cab', 'driver', 'cabbookingrequest', 'cabbookingaccepted', 'pricing', 'vehicle', 'hostcabratecard'
    ];

    // Check if this is a generic CRUD route
    if (req.params && req.params.modelName) {
      const requestedModel = req.params.modelName.toLowerCase();
      if (allowedCabModels.includes(requestedModel)) {
        return next();
      }
    }

    // Check if this is an explicitly authorized Cab Admin functional route
    const allowedPaths = ['/cab/assign-driver', '/approve-cab', '/reject-cab', '/cabs', '/drivers', '/approve-driver', '/reject-driver', '/cab/add-cab', '/cab/add-driver', '/cab/assign-driver-vehicle'];
    if (req.path && allowedPaths.some(p => req.path.includes(p))) {
        return next();
    }

    // If they try to hit Self-Drive routes like /vehicles, /listings, or unapproved tables
    return res.status(403).json({ 
      message: 'Forbidden: Your Cab Admin role does not have permission to access Self-Drive resources.' 
    });
  }

  // Fallback block if an admin doesn't have a known role
  return res.status(403).json({ message: 'Forbidden: Unrecognized Admin Role.' });
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
    // const existingDriver = await Driver.findOne({ where: { phone } });

    if (existingUser) {
      return res.status(400).json({ message: 'User with this phone already exists' });
    }

    const uuid = require('uuid');
    const newId = uuid.v4();
    let user;

    // Handle different roles
    switch (role) {
      case 'user':
        user = await User.create({
          id: newId,
          phone,
          password: await bcrypt.hash(password, 10),
        });
        break;
      case 'host':
        user = await Host.create({
          id: newId,
          phone,
          password: await bcrypt.hash(password, 10),
        });
        break;
      case 'admin':
        user = await Admin.create({
          id: newId,
          phone,
          password: await bcrypt.hash(password, 10),
        });
        break;
      case 'Driver':
        user = await User.create({
          id: newId,
          phone,
          password: "1234", // Plain text for drivers initially to align with OTP-based verification
          role: 'driver'
        });
        await Driver.create({
          id: newId,
          isActive: false
        });
        break;
      default:
        return res.status(400).json({ message: 'Invalid role' });
    }

    const token = generateToken({ id: user.id, role });
    res.status(201).json({ message: `${role} created`, user, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating user', error: error.message || String(error) });
  }
};

module.exports = {
  authenticate,
  restrictToSuperadmin,
  signup,
  generateToken,
};
