module.exports = (sequelize, DataTypes) => {
  const Subscriptions = sequelize.define("Subscriptions", {
    PlanType: { type: DataTypes.STRING(36), allowNull: false, primaryKey: true },
    vehicleType: { type: DataTypes.INTEGER, allowNull: false},
    PlanName: { type: DataTypes.STRING, allowNull: false },
    expiry: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.FLOAT, allowNull: false },
    Remarks: { type: DataTypes.TEXT, allowNull: true }
  });
  return Subscriptions;
};