module.exports = (sequelize, DataTypes) => {
  const VehicleType = sequelize.define("VehicleType", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    vehicletype: DataTypes.STRING,
    description: DataTypes.TEXT,
    basePrice: DataTypes.FLOAT
  })

  return VehicleType;
};
