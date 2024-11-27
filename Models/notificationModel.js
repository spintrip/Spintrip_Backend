// notificationModel.js
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define("Notification", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    receiverId: {
      type: DataTypes.STRING(36),
      allowNull: false,
    },
    receiverType: {
      type: DataTypes.ENUM("user", "driver"),
      allowNull: false,
    },
    text: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    deviceToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "delivered", "read"),
      defaultValue: "pending",
    },
    metadata: {
      type: DataTypes.JSON, // For storing additional data if needed
      allowNull: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  });

  Notification.associate = (models) => {
    Notification.belongsTo(models.User, {
      foreignKey: "receiverId",
      constraints: false,
      scope: { receiverType: "user" },
    });
    Notification.belongsTo(models.Driver, {
      foreignKey: "receiverId",
      constraints: false,
      scope: { receiverType: "driver" },
    });
  };

  return Notification;
};
