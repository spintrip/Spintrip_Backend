// models/CabSchedule.js
module.exports = (sequelize, DataTypes) => {
  const CabSchedule = sequelize.define('CabSchedule', {
    vehicleid: DataTypes.INTEGER,
    driverid: DataTypes.INTEGER,
    bookingId: DataTypes.INTEGER,
    startTime: DataTypes.DATE,
    endTime: DataTypes.DATE,
    pickup: DataTypes.STRING,
    destination: DataTypes.STRING,
    status: DataTypes.STRING // RESERVED, CONFIRMED, CANCELLED
  });

  return CabSchedule;
};
