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

    // Cab pricing
    pricingType: {
      type: DataTypes.STRING, 
      allowNull: true,
    },

    priceperkm: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    fixedPrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    packagePrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    baseKm: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    extraKmPrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  });

  return Pricing;
};