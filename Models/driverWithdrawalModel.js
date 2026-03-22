module.exports = (sequelize, DataTypes) => {
  const DriverWithdrawal = sequelize.define('DriverWithdrawal', {
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
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
    },
    bankDetails: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  });

  return DriverWithdrawal;
};
