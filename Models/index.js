const { Sequelize, DataTypes } = require('sequelize');
const { Worker } = require('worker_threads');
require('dotenv').config();

const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_PORT = process.env.DB_PORT;
const DB_NAME = process.env.DB_NAME;

const sequelize = new Sequelize(`postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`, {
  dialect: 'postgres',
  pool: {
    max: 2000,
    min: 50,
    acquire: 30000,
    idle: 10000,
  },
  logging: false,
});

sequelize.authenticate()
  .then(() => {
    console.log('Database connected successfully');
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
  });

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models
db.User = require('./userModel')(sequelize, DataTypes);
db.Admin = require('./adminModel')(sequelize, DataTypes);
db.Host = require('./hostModel')(sequelize, DataTypes);
db.Car = require('./carModel')(sequelize, DataTypes);
db.Vehicle = require('./vehicleModel')(sequelize, DataTypes);
db.Bike = require('./bikeModel')(sequelize, DataTypes);
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

// New Cab SaaS Models
db.Driver = require('./driverModel')(sequelize, DataTypes);
db.CabToDriver = require('./CabtoDriverModel')(sequelize, DataTypes);
db.CabBookingRequest = require('./cabBookingRequestModel')(sequelize, DataTypes);
db.CabBookingAccepted = require('./cabBookingAcceptModel')(sequelize, DataTypes);
db.DriverKeepAlive = require('./driverKeepAliveModel')(sequelize, DataTypes);

const associateModels = () => {
  const {
    User, Admin, Car, Host, UserAdditional, Booking, Listing, Feedback, Support,
    SupportChat, Tax, Wishlist, Device, Feature, carFeature, Blog, BlogComment,
    carDevices, HostPayment, Transaction, Vehicle, Bike, HostAdditional, VehicleAdditional,
    Driver, CabToDriver, CabBookingRequest, CabBookingAccepted, DriverKeepAlive
  } = sequelize.models;

  // Existing associations
  carDevices.belongsTo(Car, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Support.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
  SupportChat.belongsTo(Support, { foreignKey: 'supportId', onDelete: 'CASCADE' });
  SupportChat.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
  SupportChat.belongsTo(Admin, { foreignKey: 'adminId', onDelete: 'CASCADE' });
  carFeature.belongsTo(Feature, { foreignKey: 'featureid', onDelete: 'CASCADE' });
  carFeature.belongsTo(Car, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  BlogComment.belongsTo(Blog, { foreignKey: 'blogId', onDelete: 'CASCADE' });

  // New associations for Cab SaaS
  Driver.hasMany(CabToDriver, { foreignKey: 'driverid', onDelete: 'CASCADE' });
  CabToDriver.belongsTo(Driver, { foreignKey: 'driverid', onDelete: 'CASCADE' });
  CabToDriver.belongsTo(Vehicle, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });

  Driver.hasMany(DriverKeepAlive, { foreignKey: 'driverId', onDelete: 'CASCADE' });
  DriverKeepAlive.belongsTo(Driver, { foreignKey: 'driverId', onDelete: 'CASCADE' });

  CabBookingRequest.belongsTo(Vehicle, { foreignKey: 'vehicleId', onDelete: 'SET NULL' });
  CabBookingRequest.belongsTo(Driver, { foreignKey: 'driverId', onDelete: 'SET NULL' });

  CabBookingAccepted.belongsTo(CabBookingRequest, { foreignKey: 'bookingId', onDelete: 'CASCADE' });
  CabBookingAccepted.belongsTo(Driver, { foreignKey: 'driverId', onDelete: 'CASCADE' });

  // Adjust other existing associations
  User.hasMany(Support, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Support.hasMany(SupportChat, { foreignKey: 'supportId', onDelete: 'CASCADE' });
  Vehicle.belongsTo(Host, { foreignKey: 'hostId', onDelete: 'SET NULL' });
  Host.hasMany(Vehicle, { foreignKey: 'hostId', sourceKey: 'id', onDelete: 'SET NULL' });
  Vehicle.hasMany(Feedback, { foreignKey: 'vehicleid', onDelete: 'SET NULL' });
  Feedback.belongsTo(Vehicle, { foreignKey: 'vehicleid', onDelete: 'SET NULL' });

  HostPayment.belongsTo(Host, { foreignKey: 'HostId', onDelete: 'CASCADE' });
  HostPayment.belongsTo(Vehicle, { foreignKey: 'VehicleId', onDelete: 'CASCADE' });
};

associateModels();

module.exports = db;
