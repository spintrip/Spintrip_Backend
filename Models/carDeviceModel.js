module.exports = (sequelize, DataTypes) => {
  const carDevices = sequelize.define("carDevices", {
    deviceid: {type: DataTypes.STRING, primaryKey: true },
    vehicleid: { type: DataTypes.STRING(36)},
  });

  return carDevices;
};
