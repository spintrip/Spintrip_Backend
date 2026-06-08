module.exports = (sequelize, DataTypes) => {
  const AgentWalletTransaction = sequelize.define("AgentWalletTransaction", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    walletId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("deposit", "payment", "refund", "commission", "credit_adjustment"),
      allowNull: false,
    },
    referenceId: {
      type: DataTypes.STRING(36), // e.g. bookingId, transaction ID
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  });

  return AgentWalletTransaction;
};
