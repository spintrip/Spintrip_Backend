module.exports = (sequelize, DataTypes) => {
  const ReturnTripMarketplace = sequelize.define("ReturnTripMarketplace", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    driverId: {
      type: DataTypes.STRING(36),
      allowNull: false,
    },
    vehicleId: {
      type: DataTypes.STRING(36),
      allowNull: false,
    },
    origin: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    destination: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    timeWindowStart: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    timeWindowEnd: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    expectedPrice: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    discountPercentage: {
      type: DataTypes.FLOAT,
      defaultValue: 20.0,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "booked", "expired"),
      defaultValue: "active",
      allowNull: false,
    },
  });

  return ReturnTripMarketplace;
};
