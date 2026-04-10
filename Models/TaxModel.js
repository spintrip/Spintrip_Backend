module.exports = (sequelize, DataTypes) => {
  const Tax = sequelize.define("Tax", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    GST: { type: DataTypes.FLOAT, defaultValue: 5 },
    TDS: { type: DataTypes.FLOAT, defaultValue: 1 },
    HostGST: { type: DataTypes.FLOAT, defaultValue: 5 },
    Commission: { type: DataTypes.FLOAT, defaultValue: 10 },
    insurance: { type: DataTypes.FLOAT, defaultValue: 2 },
  });
  return Tax;
};
