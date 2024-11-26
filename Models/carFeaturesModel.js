module.exports = (sequelize, DataTypes) => {
    const carFeature= sequelize.define("carFeature", {
      featureid: { type: DataTypes.UUID },
      vehicleid: DataTypes.STRING(36),
      price: DataTypes.FLOAT,
    });
    return carFeature;
  };
  