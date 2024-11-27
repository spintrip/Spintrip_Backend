module.exports = (sequelize, DataTypes) => {
  const VehicleAdditional = sequelize.define("VehicleAdditional", {
    vehicleid: { type: DataTypes.STRING(36), primaryKey: true },
    Additionalinfo: DataTypes.TEXT,
    vehicleimage1: DataTypes.STRING,
    vehicleimage2: DataTypes.STRING,
    vehicleimage3: DataTypes.STRING,
    vehicleimage4: DataTypes.STRING,
    vehicleimage5: DataTypes.STRING,
    verification_status: DataTypes.INTEGER,
    latitude: DataTypes.FLOAT,
    longitude: DataTypes.FLOAT,
    address: DataTypes.TEXT,
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    indexes: [
      {
        name: 'timestamp_index', // Name of the index
        fields: ['timestamp'], // Fields to index
      },
    ],
  });

  return VehicleAdditional;
};
