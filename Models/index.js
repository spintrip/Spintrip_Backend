const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config(); // Load environment variables from .env

// Database configuration
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_PORT = process.env.DB_PORT;
const DB_NAME = process.env.DB_NAME;

// Initialize Sequelize
const sequelize = new Sequelize(`postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`, {
  dialect: 'postgres',
  pool: {
    max: 2000, // Adjust pool size based on expected traffic
    min: 50,
    acquire: 30000,
    idle: 10000,
  },
  logging: false, // Disable logging in production
});

// Test the database connection
sequelize.authenticate()
  .then(() => {
    console.log('Database connected successfully');
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
  });

// Initialize the database object
const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import all models
db.User = require('./userModel')(sequelize, DataTypes);
db.Admin = require('./adminModel')(sequelize, DataTypes);
db.Host = require('./hostModel')(sequelize, DataTypes);
db.Car = require('./carModel')(sequelize, DataTypes);
db.Bike = require('./bikeModel')(sequelize, DataTypes);
db.Vehicle = require('./vehicleModel')(sequelize, DataTypes);
db.UserAdditional = require('./userAdditionalModel')(sequelize, DataTypes);
db.HostAdditional = require('./hostAdditionalModel')(sequelize, DataTypes);
db.VehicleAdditional = require('./vehicleAdditional')(sequelize, DataTypes);
db.Booking = require('./bookingModel')(sequelize, DataTypes);
db.Brand = require('./brandModel')(sequelize, DataTypes);
db.Listing = require('./listingModel')(sequelize, DataTypes);
db.Pricing = require('./pricingModel')(sequelize, DataTypes);
db.Feedback = require('./feedback')(sequelize, DataTypes);
db.Chat = require('./chatModel')(sequelize, DataTypes);
db.Tax = require('./TaxModel')(sequelize, DataTypes);
db.Support = require('./supportModel')(sequelize, DataTypes);
db.SupportChat = require('./supportChatModel')(sequelize, DataTypes);
db.Wishlist = require('./wishlistModel')(sequelize, DataTypes);
db.Transaction = require('./TransactionModel')(sequelize, DataTypes);
db.Blog = require('./blogModel')(sequelize, DataTypes);
db.BlogComment = require('./blogCommentModel')(sequelize, DataTypes);
db.Device = require('./deviceModel')(sequelize, DataTypes);
db.Feature = require('./featureModel')(sequelize, DataTypes);
db.carFeature = require('./carFeaturesModel')(sequelize, DataTypes);
db.carDevices = require('./carDeviceModel')(sequelize, DataTypes);
db.HostPayment = require('./hostPaymentModel')(sequelize, DataTypes);
db.Driver = require('./driverModel')(sequelize, DataTypes);
db.CabToDriver = require('./CabtoDriverModel')(sequelize, DataTypes);
db.Cab = require('./cabModel')(sequelize, DataTypes);
db.CabBookingRequest = require('./cabBookingRequestModel')(sequelize, DataTypes);
db.CabBookingAccepted = require('./cabBookingAcceptModel')(sequelize, DataTypes);

const associateModels = () => {
  const {
    User, Admin, Host, Car, Bike, Vehicle, UserAdditional, HostAdditional, VehicleAdditional,
    Booking, Listing, Feedback, Pricing, Support, SupportChat, Wishlist, Feature, carFeature,
    Device, carDevices, Blog, BlogComment, Transaction, HostPayment, Driver, CabToDriver,
    CabBookingRequest, CabBookingAccepted, DriverKeepAlive, Cab
  } = sequelize.models;

  // User and related associations
  User.hasOne(Admin, { foreignKey: 'userId', onDelete: 'SET NULL' });
  User.hasOne(Host, { foreignKey: 'userId', onDelete: 'SET NULL' });
  User.hasMany(Support, { foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(Booking, { foreignKey: 'userId', onDelete: 'SET NULL' });
  User.hasMany(SupportChat, { foreignKey: 'userId', onDelete: 'CASCADE' });

  // Admin associations
  Admin.hasMany(SupportChat, { foreignKey: 'adminId', onDelete: 'CASCADE' });
  Admin.belongsTo(User, { foreignKey: 'id', onDelete: 'SET NULL' });

  // Host and Vehicle associations
  Host.hasMany(Vehicle, { foreignKey: 'hostId', onDelete: 'CASCADE' });
  Vehicle.belongsTo(Host, { foreignKey: 'hostId', onDelete: 'CASCADE' });

  // Vehicle-specific associations
  Vehicle.hasOne(Car, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Vehicle.hasOne(Bike, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Vehicle.hasMany(Feedback, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Vehicle.hasOne(Listing, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Vehicle.hasOne(VehicleAdditional, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Vehicle.hasOne(Pricing, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  VehicleAdditional.belongsTo(Vehicle, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });

  // Car and Bike associations
  Car.belongsTo(Vehicle, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Bike.belongsTo(Vehicle, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });

  // Feedback associations
  Feedback.belongsTo(Vehicle, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });

  // Listing associations
  Listing.belongsTo(Vehicle, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Listing.belongsTo(Host, { foreignKey: 'hostid', onDelete: 'CASCADE' });

  // Booking associations
  Booking.belongsTo(Vehicle, { foreignKey: 'vehicleid', onDelete: 'SET NULL' });
  Booking.belongsTo(User, { foreignKey: 'userId', onDelete: 'SET NULL' });
  Booking.belongsTo(UserAdditional, { foreignKey: 'userId', onDelete: 'SET NULL' });

  // UserAdditional associations
  UserAdditional.belongsTo(User, { foreignKey: 'id', onDelete: 'SET NULL' });

  // Cab SaaS associations
  Driver.hasMany(CabToDriver, { foreignKey: 'driverid', onDelete: 'CASCADE' });
  CabToDriver.belongsTo(Driver, { foreignKey: 'driverid', onDelete: 'CASCADE' });
  CabToDriver.belongsTo(Vehicle, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });

  // Pricing and Transaction associations
  HostPayment.belongsTo(Host, { foreignKey: 'HostId', onDelete: 'CASCADE' });
  HostPayment.belongsTo(Vehicle, { foreignKey: 'VehicleId', onDelete: 'CASCADE' });

  // Blog and BlogComment associations
  Blog.hasMany(BlogComment, { foreignKey: 'blogId', onDelete: 'CASCADE' });
  BlogComment.belongsTo(Blog, { foreignKey: 'blogId', onDelete: 'CASCADE' });

  // Feature and carFeature associations
  carFeature.belongsTo(Feature, { foreignKey: 'featureid', onDelete: 'CASCADE' });
  carFeature.belongsTo(Vehicle, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });

  // Device associations
  carDevices.belongsTo(Car, { foreignKey: 'carid', onDelete: 'CASCADE' });

  // Support and SupportChat associations
  Support.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Support.hasMany(SupportChat, { foreignKey: 'supportId', onDelete: 'CASCADE' });
  SupportChat.belongsTo(Support, { foreignKey: 'supportId', onDelete: 'CASCADE' });
  SupportChat.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
  SupportChat.belongsTo(Admin, { foreignKey: 'adminId', onDelete: 'CASCADE' });

};

associateModels();

module.exports = db;
