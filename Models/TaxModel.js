module.exports = (sequelize, DataTypes) => {
  const Tax = sequelize.define("Tax", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    GST: { type: DataTypes.FLOAT, defaultValue: 18 },
  });
  return Tax;
};
