module.exports = (sequelize, DataTypes) => {
  const Pricing = sequelize.define("Pricing", {
    vehicleid: {
      type: DataTypes.STRING(36),
      primaryKey: true,
    },
    // Self-drive pricing
    costperhr: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  });

  return Pricing;
};