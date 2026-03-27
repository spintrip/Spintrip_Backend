module.exports = (sequelize, DataTypes) => {
  const HostCabRateCard = sequelize.define("HostCabRateCard", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    hostId: {
      type: DataTypes.STRING(36),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cabType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    airportTransferPrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    halfDayPrice: { // 4Hrs 40Kms
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    fullDayPrice: { // 8Hrs 80Kms
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    extraHourRate: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    extraKmRate: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    outstationPerKmPrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    driverAllowancePerDay: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    surgeMultiplier: {
      type: DataTypes.FLOAT,
      defaultValue: 1.0,
      allowNull: true,
    },
    tollCharges: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0,
      allowNull: true,
    },
    offers: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    timestamps: true,
  });

  HostCabRateCard.associate = (models) => {
    HostCabRateCard.belongsTo(models.Host, { foreignKey: 'hostId', constraints: false });
  };

  return HostCabRateCard;
};
