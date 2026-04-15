module.exports = (sequelize, DataTypes) => {
  const SupportChat = sequelize.define("SupportChat", {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    supportId:  { type: DataTypes.STRING(36) },
    userId: { type: DataTypes.STRING(36) },
    adminId:  { type: DataTypes.STRING(36) },
    senderId: { type: DataTypes.STRING(36) },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isBot: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  });


  return SupportChat;
};
