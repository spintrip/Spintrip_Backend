module.exports = (sequelize, DataTypes) => {
  const HostPayment = sequelize.define("HostPayment", {
    PaymentId: { type: DataTypes.STRING(36), primaryKey: true },
    HostId: { type: DataTypes.STRING(36), allowNull: false },
    VehicleId: { type: DataTypes.STRING(36), allowNull: false },
    PaymentDate: { type: DataTypes.DATEONLY, allowNull: false },
    Amount: { type: DataTypes.FLOAT, allowNull: false },
    GSTAmount: { type: DataTypes.FLOAT, allowNull: true },
    TotalAmount: { type: DataTypes.FLOAT, allowNull: false },
    PaymentStatus: { type: DataTypes.INTEGER, allowNull: false },
    PaymentMethod: { type: DataTypes.STRING, allowNull: false },
    TransactionId: { type: DataTypes.STRING, allowNull: true },
    PlanEndDate: { type: DataTypes.DATEONLY, allowNull: false },
    PlanType: { type: DataTypes.STRING(36), allowNull: false },
    Remarks: { type: DataTypes.TEXT, allowNull: true }
  });

  HostPayment.associate = (models) => {
    HostPayment.belongsTo(models.Host, { foreignKey: 'HostId' });
    HostPayment.belongsTo(models.Vehicle, { foreignKey: 'VehicleId' });
   // HostPayment.belongsTo(models.Transaction, { foreignKey: 'TransactionId', targetKey: 'Transactionid' });
  };

  return HostPayment;
};