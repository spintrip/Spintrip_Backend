
module.exports = (sequelize, DataTypes) => {
  const ReferralReward = sequelize.define("ReferralReward", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING(36),
      allowNull: false,
    },
    amount: { 
      type: DataTypes.FLOAT, 
      defaultValue: 100.0 // ₹100
    }, 
    status: {
      type: DataTypes.ENUM('pending', 'earned', 'used', 'expired'),
      defaultValue: 'pending',
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: true, // Will be set when status becomes 'earned'
    },
  });

  ReferralReward.associate = (models) => {
    ReferralReward.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return ReferralReward;
};
