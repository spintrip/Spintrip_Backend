module.exports = (sequelize, DataTypes) => {
  const AgentWallet = sequelize.define("AgentWallet", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    agentId: {
      type: DataTypes.STRING(36),
      allowNull: false,
      unique: true, // One wallet per agent
    },
    balance: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0,
      allowNull: false,
    },
    creditLimit: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0,
      allowNull: false,
    },
    outstandingCredit: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0,
      allowNull: false,
    },
    escrowBalance: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0,
      allowNull: false,
    },
  });

  return AgentWallet;
};
