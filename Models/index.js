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
    max: 200,
    min: 5,
    acquire: 30000,
    idle: 10000
  },
  logging:false
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

db.User = require('./userModel')(sequelize, DataTypes);
db.Admin = require('./adminModel')(sequelize, DataTypes);
db.Host = require('./hostModel')(sequelize, DataTypes);
db.Car = require('./carModel')(sequelize, DataTypes);
db.UserAdditional = require('./userAdditionalModel')(sequelize, DataTypes);
db.CarAdditional = require('./carAdditionalModel')(sequelize, DataTypes);
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
db.Payout = require('./payoutModel')(sequelize, DataTypes);
db.BookingExtenstion = require('./bookingExtension')(sequelize, DataTypes);
const associateModels = () => {
  const { User, Admin, Car, Host, UserAdditional, Booking, Listing, CarAdditional, 
    Feedback, Support, SupportChat, Tax, Wishlist, Device, Feature, carFeature, Blog, BlogComment, carDevices  } = sequelize.models;

  carDevices.belongsTo(Car, { foreignKey: 'carid', onDelete: 'CASCADE' })  
  Support.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
  SupportChat.belongsTo(Support, { foreignKey: 'supportId', onDelete: 'CASCADE' });
  SupportChat.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
  SupportChat.belongsTo(Admin, { foreignKey: 'adminId', onDelete: 'CASCADE' });
  carFeature.belongsTo(Feature, { foreignKey: 'featureid', onDelete: 'CASCADE' });
  carFeature.belongsTo(Car, { foreignKey: 'carid', onDelete: 'CASCADE' });
  BlogComment.belongsTo(Blog, {foreignKey: 'blogId', onDelete: 'CASCADE'});
  User.hasMany(Support, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Support.hasMany(SupportChat, { foreignKey: 'supportId', onDelete: 'CASCADE' });
  User.hasMany(SupportChat, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Admin.hasMany(SupportChat, { foreignKey: 'adminId', onDelete: 'CASCADE' });
  Host.belongsTo(User, { foreignKey: 'id', onDelete: 'CASCADE' });
  Admin.belongsTo(User, { foreignKey: 'id', onDelete: 'CASCADE' });
  UserAdditional.belongsTo(User, { foreignKey: 'id', onDelete: 'CASCADE' });
  CarAdditional.belongsTo(Car, { foreignKey: 'carid', onDelete: 'CASCADE' });
  Car.belongsTo(Host, { foreignKey: 'carid', onDelete: 'CASCADE' });
  Booking.hasOne(User);
  Booking.hasOne(Car);
  Booking.belongsTo(User, { foreignKey: 'id', onDelete: 'CASCADE'});
  Booking.belongsTo(Car, { foreignKey: 'carid', onDelete: 'CASCADE' });
  Booking.belongsTo(UserAdditional, { foreignKey: 'id', onDelete: 'CASCADE' });
  User.hasOne(Admin);
  User.hasOne(Host);
  User.hasMany(Booking);
  Car.hasOne(carDevices);
  Listing.hasOne(Car, { foreignKey: 'carid', onDelete: 'CASCADE' });
  Listing.hasOne(Host, { foreignKey: 'id', sourcekey: 'hostid', onDelete: 'CASCADE' });
  Host.hasMany(Car, { foreignKey: 'carhostid', sourceKey: 'id', onDelete: 'CASCADE' });
  Car.hasMany(Feedback, { foreignKey: 'carId', onDelete: 'CASCADE' });
  Feedback.belongsTo(Car, { foreignKey: 'carId', onDelete: 'CASCADE' });
};

associateModels();

module.exports = db;
