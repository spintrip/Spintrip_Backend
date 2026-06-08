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

    // AUTO-PATCH: Cleanup HostCabRateCards and Sync UserAddresses
    await sequelize.query(`ALTER TABLE "HostCabRateCards" DROP CONSTRAINT IF EXISTS "HostCabRateCards_hostId_fkey";`);
    await sequelize.query(`ALTER TABLE "HostCabRateCards" ALTER COLUMN "hostId" DROP NOT NULL;`);
    await sequelize.query(`ALTER TABLE "UserAddresses" ADD COLUMN IF NOT EXISTS "addressType" VARCHAR(20) DEFAULT 'Other';`);
    await sequelize.query(`ALTER TABLE "UserAddresses" ALTER COLUMN "fullAddress" TYPE VARCHAR(500);`);
    
    console.log('Database Health Check: All schemas optimized and expanded.');
    
    // AUTO-PATCH: Fix Supports table schema
    await sequelize.query(`ALTER TABLE "Supports" ADD COLUMN IF NOT EXISTS "category" VARCHAR(255) DEFAULT 'general';`);
    await sequelize.query(`ALTER TABLE "Supports" ADD COLUMN IF NOT EXISTS "bookingId" VARCHAR(36);`);
    await sequelize.query(`ALTER TABLE "Supports" ADD COLUMN IF NOT EXISTS "vehicleId" VARCHAR(36);`);
    await sequelize.query(`ALTER TABLE "Supports" ADD COLUMN IF NOT EXISTS "metadata" JSONB;`);
    await sequelize.query(`ALTER TABLE "Supports" ADD COLUMN IF NOT EXISTS "priority" INTEGER DEFAULT 1;`);
    await sequelize.query(`ALTER TABLE "Supports" ADD COLUMN IF NOT EXISTS "escalations" INTEGER DEFAULT 0;`);
    
    // AUTO-PATCH: Fix SupportChats table schema
    await sequelize.query(`ALTER TABLE "SupportChats" ADD COLUMN IF NOT EXISTS "isBot" BOOLEAN DEFAULT FALSE;`);
    await sequelize.query(`ALTER TABLE "SupportChats" ADD COLUMN IF NOT EXISTS "adminId" VARCHAR(36);`);
    
    // AUTO-PATCH: Offers & Discounts schema expansion
    await sequelize.query(`ALTER TABLE "Bookings" ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION DEFAULT 0;`);
    await sequelize.query(`ALTER TABLE "Bookings" ADD COLUMN IF NOT EXISTS "offerId" VARCHAR(36);`);
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "Offers" (
        "id" UUID PRIMARY KEY,
        "code" VARCHAR(255) NOT NULL UNIQUE,
        "percentage" DOUBLE PRECISION DEFAULT 0,
        "maxDiscount" DOUBLE PRECISION DEFAULT 0,
        "minAmount" DOUBLE PRECISION DEFAULT 0,
        "expiryDate" TIMESTAMP WITH TIME ZONE,
        "isActive" BOOLEAN DEFAULT TRUE,
        "usageLimit" INTEGER DEFAULT -1,
        "usedCount" INTEGER DEFAULT 0,
        "description" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    await sequelize.query(`ALTER TABLE "CabBookingRequests" ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION DEFAULT 0;`);
    await sequelize.query(`ALTER TABLE "CabBookingRequests" ADD COLUMN IF NOT EXISTS "offerId" VARCHAR(36);`);
    await sequelize.query(`ALTER TABLE "CabBookingRequests" ADD COLUMN IF NOT EXISTS "offerCode" VARCHAR(255);`);

    // AUTO-PATCH: Driver Verification schema expansion
    await sequelize.query(`ALTER TABLE "DriverAdditionals" ADD COLUMN IF NOT EXISTS "PanVfid" VARCHAR(20);`);
    await sequelize.query(`ALTER TABLE "DriverAdditionals" ADD COLUMN IF NOT EXISTS "pan" VARCHAR(500);`);

    // AUTO-PATCH: Global Surge Pricing schema
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SurgePrices" (
        "id" UUID PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "city" VARCHAR(255),
        "cabType" VARCHAR(255),
        "multiplier" DOUBLE PRECISION DEFAULT 1.0,
        "startTime" TIME NOT NULL,
        "endTime" TIME NOT NULL,
        "startDate" DATE,
        "endDate" DATE,
        "daysOfWeek" VARCHAR(255),
        "isActive" BOOLEAN DEFAULT TRUE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    await sequelize.query(`ALTER TABLE "SurgePrices" ADD COLUMN IF NOT EXISTS "bookingType" VARCHAR(20);`);
    // AUTO-PATCH: Add referenceId and description to Transactions for cab payment tracking
    await sequelize.query(`ALTER TABLE "Transactions" ADD COLUMN IF NOT EXISTS "referenceId" VARCHAR(36);`);
    await sequelize.query(`ALTER TABLE "Transactions" ADD COLUMN IF NOT EXISTS "description" VARCHAR(255);`);
    
    // AUTO-PATCH: Add agentId and related structures for Agents manually booking ETS
    await sequelize.query(`ALTER TABLE "CabBookingRequests" ADD COLUMN IF NOT EXISTS "agentId" VARCHAR(36);`);

    // AUTO-PATCH: Create AgentWallets and AgentWalletTransactions tables safely
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "AgentWallets" (
        "id" UUID PRIMARY KEY,
        "agentId" VARCHAR(36) NOT NULL UNIQUE,
        "balance" DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
        "creditLimit" DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
        "outstandingCredit" DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
        "escrowBalance" DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "AgentWalletTransactions" (
        "id" UUID PRIMARY KEY,
        "walletId" UUID NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "type" VARCHAR(50) NOT NULL,
        "referenceId" VARCHAR(36),
        "description" VARCHAR(255),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    // AUTO-PATCH: Create ReturnTripMarketplaces table safely
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "ReturnTripMarketplaces" (
        "id" UUID PRIMARY KEY,
        "driverId" VARCHAR(36) NOT NULL,
        "vehicleId" VARCHAR(36) NOT NULL,
        "origin" VARCHAR(255) NOT NULL,
        "destination" VARCHAR(255) NOT NULL,
        "date" DATE NOT NULL,
        "timeWindowStart" TIME,
        "timeWindowEnd" TIME,
        "expectedPrice" DOUBLE PRECISION NOT NULL,
        "discountPercentage" DOUBLE PRECISION DEFAULT 20.0 NOT NULL,
        "status" VARCHAR(50) DEFAULT 'active' NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    // AUTO-PATCH: Add passengerName and passengerPhone to CabBookingRequests and Bookings for Family Booking Mode
    await sequelize.query(`ALTER TABLE "CabBookingRequests" ADD COLUMN IF NOT EXISTS "passengerName" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "CabBookingRequests" ADD COLUMN IF NOT EXISTS "passengerPhone" VARCHAR(50);`);
    await sequelize.query(`ALTER TABLE "Bookings" ADD COLUMN IF NOT EXISTS "passengerName" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "Bookings" ADD COLUMN IF NOT EXISTS "passengerPhone" VARCHAR(50);`);
    await sequelize.query(`ALTER TABLE "CabBookingRequests" ADD COLUMN IF NOT EXISTS "hours" INTEGER DEFAULT 0;`);
    await sequelize.query(`ALTER TABLE "Subscriptions" ADD COLUMN "broadcasts" INTEGER DEFAULT 0;`);

    // AUTO-PATCH: Add preference to Drivers for customized driver filter matches
    await sequelize.query(`ALTER TABLE "Drivers" ADD COLUMN IF NOT EXISTS "preference" VARCHAR(50) DEFAULT 'All';`);

    

    // AUTO-PATCH: Create AirportQueues table safely for FIFO driver airport queuing
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "AirportQueues" (
        "id" UUID PRIMARY KEY,
        "driverId" VARCHAR(36) NOT NULL UNIQUE,
        "airportCode" VARCHAR(10) NOT NULL,
        "queuePosition" INTEGER NOT NULL,
        "status" VARCHAR(50) DEFAULT 'waiting' NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    // AUTO-PATCH: AppSettings table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "AppSettings" (
        "key" VARCHAR(255) PRIMARY KEY,
        "value" VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Seed disable_vehicle_addition setting if not present
    const [settings] = await sequelize.query(`SELECT * FROM "AppSettings" WHERE "key" = 'disable_vehicle_addition';`);
    if (settings.length === 0) {
      await sequelize.query(`INSERT INTO "AppSettings" ("key", "value") VALUES ('disable_vehicle_addition', 'false');`);
      console.log('Seeded disable_vehicle_addition = false');
    }
    
    console.log('Offers and Discounts schema synchronized.');
    console.log('Driver Verification schema synchronized.');
    console.log('Support schema synchronized.');

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
db.ReferralReward = require('./referralRewardModel')(sequelize, DataTypes);
db.Offer = require('./OfferModel')(sequelize, DataTypes);
db.SurgePrice = require('./SurgeModel')(sequelize, DataTypes);
db.AppSetting = require('./appSettingModel')(sequelize, DataTypes);
db.AgentWallet = require('./AgentWalletModel')(sequelize, DataTypes);
db.AgentWalletTransaction = require('./AgentWalletTransactionModel')(sequelize, DataTypes);
db.ReturnTripMarketplace = require('./ReturnTripModel')(sequelize, DataTypes);
db.AirportQueue = require('./AirportQueueModel')(sequelize, DataTypes);

const associateModels = () => {
  const {
    User, Admin, Host, Car, Bike, Vehicle, UserAdditional, HostAdditional, VehicleAdditional, DriverAdditional,
    Booking, Listing, Feedback, Pricing, Support, SupportChat, Wishlist, Feature, carFeature,
    Device, carDevices, Blog, BlogComment, Transaction, HostPayment, Driver,
    CabBookingRequest, CabBookingAccepted, DriverKeepAlive, Cab, UserAddress, CabSchedule,
    Wallet, WalletTransaction, HostCabRateCard, DriverWithdrawal, VehicleType, ReferralReward, Offer, SurgePrice,
    AgentWallet, AgentWalletTransaction, ReturnTripMarketplace, AirportQueue
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
  User.hasMany(ReferralReward, { foreignKey: 'userId', sourceKey: 'id', onDelete: 'CASCADE' });
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
  
  // Referral associations
  ReferralReward.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' });

  // Agent Wallet associations
  User.hasOne(AgentWallet, { foreignKey: 'agentId', sourceKey: 'id', onDelete: 'CASCADE' });
  AgentWallet.belongsTo(User, { foreignKey: 'agentId', targetKey: 'id' });
  AgentWallet.hasMany(AgentWalletTransaction, { foreignKey: 'walletId', sourceKey: 'id', onDelete: 'CASCADE' });
  AgentWalletTransaction.belongsTo(AgentWallet, { foreignKey: 'walletId', targetKey: 'id' });

  // ReturnTripMarketplace associations
  Driver.hasMany(ReturnTripMarketplace, { foreignKey: 'driverId', sourceKey: 'id', onDelete: 'CASCADE' });
  ReturnTripMarketplace.belongsTo(Driver, { foreignKey: 'driverId', targetKey: 'id' });
  Vehicle.hasMany(ReturnTripMarketplace, { foreignKey: 'vehicleId', sourceKey: 'vehicleid', onDelete: 'CASCADE' });
  ReturnTripMarketplace.belongsTo(Vehicle, { foreignKey: 'vehicleId', targetKey: 'vehicleid' });

  // AirportQueue associations
  Driver.hasOne(AirportQueue, { foreignKey: 'driverId', sourceKey: 'id', onDelete: 'CASCADE' });
  AirportQueue.belongsTo(Driver, { foreignKey: 'driverId', targetKey: 'id' });
};

associateModels();

// Auto-Patch DB for Subscriptions
sequelize.query('ALTER TABLE "Subscriptions" ADD COLUMN IF NOT EXISTS "targetAudience" VARCHAR(255) DEFAULT \'both\';')
  .then(() => console.log('Successfully patched Subscriptions table.'))
  .catch((err) => console.log('DB Patch ignored (already exists or DB not ready).'));

// Auto-Patch DB for HostPayment - add broadcastsUsed tracking
sequelize.query('ALTER TABLE "HostPayments" ADD COLUMN IF NOT EXISTS "broadcastsUsed" INTEGER NOT NULL DEFAULT 0;')
  .then(() => console.log('Successfully patched HostPayments table (broadcastsUsed).'))
  .catch((err) => console.log('DB Patch (broadcastsUsed) ignored (already exists or DB not ready).'));

// Auto-Patch DB for Corporate setup
sequelize.query('ALTER TABLE "CabBookingRequests" ADD COLUMN IF NOT EXISTS "isCorporate" BOOLEAN DEFAULT false;')
  .then(() => console.log('Successfully patched CabBookingRequests table (isCorporate).'))
  .catch((err) => console.log('DB Patch (CabBookingRequests.isCorporate) ignored:', err.message));

sequelize.query('ALTER TABLE "Bookings" ADD COLUMN IF NOT EXISTS "isCorporate" BOOLEAN DEFAULT false;')
  .then(() => console.log('Successfully patched Bookings table (isCorporate).'))
  .catch((err) => console.log('DB Patch (Bookings.isCorporate) ignored:', err.message));

sequelize.query('ALTER TABLE "Drivers" ADD COLUMN IF NOT EXISTS "isCorporate" BOOLEAN DEFAULT false;')
  .then(() => console.log('Successfully patched Drivers table (isCorporate).'))
  .catch((err) => console.log('DB Patch (Drivers.isCorporate) ignored:', err.message));

module.exports = db;
