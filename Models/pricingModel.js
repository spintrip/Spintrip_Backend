module.exports = (sequelize, DataTypes) => {
    const Pricing = sequelize.define("Pricing", {
      costperhr: { type: DataTypes.FLOAT },
      vehicleid: { type: DataTypes.STRING(36), primaryKey: true },
    });
    return Pricing;
  };