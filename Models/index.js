const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config(); // Load environment variables from .env

// Database configuration
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_PORT = process.env.DB_PORT;
const DB_NAME = process.env.DB_NAME;

const sequelize = new Sequelize(`postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`, {
  dialect: 'postgres',
  pool: {
    max: 30, // Safely tuned for single-EC2 co-location
    min: 5,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: {
    ssl: false  // 👈 Disable SSL here
  },
  logging: false, // Disable logging in production
});

// Enable PostGIS Extension and perform standard DB Health Checks
(async () => {
  try {
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);
    console.log('PostGIS extension enabled');

    // AUTO-PATCH: Drop problematic foreign key constraint on HostCabRateCards if it exists
    // This allows global rate cards to work without requiring manual SQL execution by the user.
    await sequelize.query(`ALTER TABLE "HostCabRateCards" DROP CONSTRAINT IF EXISTS "HostCabRateCards_hostId_fkey";`);
    await sequelize.query(`ALTER TABLE "HostCabRateCards" ALTER COLUMN "hostId" DROP NOT NULL;`);
     await db.sequelize.sync({ alter: true });
    console.log('Database Health Check: HostCabRateCards constraints optimized.');

  } catch (error) {
    console.error('Error during Database initialization/health check:', error.message);
  }  
})();

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
db.DriverAdditional = require('./driverAdditionalModel')(sequelize, DataTypes);
db.City = require('./cityModel')(sequelize, DataTypes);
db.VehicleAdditional = require('./vehicleAdditional')(sequelize, DataTypes);
db.Subscriptions = require('./SubscriptionModel')(sequelize, DataTypes);
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
db.Cab = require('./cabModel')(sequelize, DataTypes);
db.CabSchedule = require('./cabSchedule')(sequelize, DataTypes);
db.CabBookingRequest = require('./cabBookingRequestModel')(sequelize, DataTypes);
db.CabBookingAccepted = require('./cabBookingAcceptModel')(sequelize, DataTypes);
db.UserAddress = require('./userAddress')(sequelize, DataTypes);
db.Wallet = require('./walletModel')(sequelize, DataTypes);
db.WalletTransaction = require('./walletTransactionModel')(sequelize, DataTypes);
db.HostCabRateCard = require('./rateCardModel')(sequelize, DataTypes);
db.DriverWithdrawal = require('./driverWithdrawalModel')(sequelize, DataTypes);
db.VehicleType = require('./vehicleTypeModel')(sequelize, DataTypes);

const associateModels = () => {
  const {
    User, Admin, Host, Car, Bike, Vehicle, UserAdditional, HostAdditional, VehicleAdditional, DriverAdditional,
    Booking, Listing, Feedback, Pricing, Support, SupportChat, Wishlist, Feature, carFeature,
    Device, carDevices, Blog, BlogComment, Transaction, HostPayment, Driver,
    CabBookingRequest, CabBookingAccepted, DriverKeepAlive, Cab, UserAddress, CabSchedule,
    Wallet, WalletTransaction, HostCabRateCard, DriverWithdrawal, VehicleType
  } = sequelize.models;

  // User and related associations
  User.hasOne(Admin, { foreignKey: 'id', onDelete: 'SET NULL' });
  User.hasOne(Host, { foreignKey: 'id', onDelete: 'SET NULL' });
  User.hasOne(Driver, { foreignKey: 'id', onDelete: 'SET NULL' });
  User.hasOne(Wallet, { foreignKey: 'userId', sourceKey: 'id', onDelete: 'CASCADE' });
  User.hasOne(UserAdditional, { foreignKey: 'id', onDelete: 'CASCADE' });
  User.hasMany(Support, { foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(Booking, { foreignKey: 'id', onDelete: 'SET NULL' });
  User.hasMany(UserAddress, { foreignKey: 'userid', onDelete: 'SET NULL' });
  User.hasMany(SupportChat, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Host.hasOne(HostAdditional, { foreignKey: 'id', onDelete: 'CASCADE' });
  Driver.hasOne(DriverAdditional, { foreignKey: 'id', onDelete: 'CASCADE' });
  UserAdditional.belongsTo(User, { foreignKey: 'id', onDelete: 'CASCADE' });
  Host.belongsTo(User, { foreignKey: 'id', onDelete: 'CASCADE' });
  Driver.belongsTo(User, { foreignKey: 'id', onDelete: 'CASCADE' });
  // Admin associations
  CabBookingRequest.belongsTo(User, { foreignKey: 'userId', as: 'Customer' });
  Admin.hasMany(SupportChat, { foreignKey: 'adminId', onDelete: 'CASCADE' });
  Admin.belongsTo(User, { foreignKey: 'id', onDelete: 'SET NULL' });

  HostAdditional.hasMany(Vehicle, { foreignKey: 'hostId', onDelete: 'CASCADE' });

Vehicle.belongsTo(HostAdditional, { foreignKey: 'hostId' });
  // Host and Vehicle associations
  Host.hasMany(Vehicle, { foreignKey: 'hostId', onDelete: 'CASCADE' });
  Host.hasMany(Driver, { foreignKey: 'hostId' });
  Host.hasMany(HostCabRateCard, { foreignKey: 'hostId', onDelete: 'CASCADE', constraints: false });
  Vehicle.belongsTo(Host, { foreignKey: 'hostId', onDelete: 'CASCADE' });

  // Vehicle-specific associations
  Vehicle.hasOne(Car, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Vehicle.hasOne(Cab, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Vehicle.hasOne(Bike, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Vehicle.hasMany(Feedback, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Vehicle.hasOne(Listing, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Vehicle.hasOne(VehicleAdditional, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Vehicle.hasOne(Pricing, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  VehicleAdditional.belongsTo(Vehicle, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Driver.belongsTo(Host, { foreignKey: 'hostid'});

  // Driver has one DriverAdditional (they share the same id)
  Driver.hasOne(DriverAdditional, { foreignKey: 'id'});

  // Driver has one User (if your User id === Driver id)
  Driver.belongsTo(User, { foreignKey: 'id' });

  // Car and Bike associations
  Car.belongsTo(Vehicle, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Bike.belongsTo(Vehicle, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
  Cab.belongsTo(Vehicle, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });
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
  Driver.hasOne(Cab, { foreignKey: 'driverId' });
  Cab.belongsTo(Driver, { foreignKey: 'driverId' });
  // Driver.belongsTo(Host, { foreignKey: 'hostid' , onDelete: 'CASCADE' });
  // Driver.hasOne(DriverAdditional, { foreignKey: 'id', onDelete: 'CASCADE' });
  // Driver.belongsTo(User, { foreignKey: 'id', onDelete: 'CASCADE' });

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
  carDevices.belongsTo(Car, { foreignKey: 'vehicleid', onDelete: 'CASCADE' });

  // Support and SupportChat associations
  Support.belongsTo(UserAdditional, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Support.hasMany(SupportChat, { foreignKey: 'supportId', onDelete: 'CASCADE' });
  SupportChat.belongsTo(Support, { foreignKey: 'supportId', onDelete: 'CASCADE' });
  SupportChat.belongsTo(UserAdditional, { foreignKey: 'userId', onDelete: 'CASCADE' });
  SupportChat.belongsTo(Admin, { foreignKey: 'adminId', onDelete: 'CASCADE' });



  // Wallet associations
  Wallet.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' });
  Wallet.hasMany(WalletTransaction, { foreignKey: 'walletId', sourceKey: 'id', onDelete: 'CASCADE' });
  WalletTransaction.belongsTo(Wallet, { foreignKey: 'walletId', targetKey: 'id' });

  // Driver Withdrawal associations
  DriverWithdrawal.belongsTo(Driver, { foreignKey: 'driverId', targetKey: 'id' });
  Driver.hasMany(DriverWithdrawal, { foreignKey: 'driverId', sourceKey: 'id', onDelete: 'CASCADE' });

};

associateModels();

module.exports = db;
