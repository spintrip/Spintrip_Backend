// notificationModel.js
module.exports = (sequelize, DataTypes) => {
    const Notification = sequelize.define("Notification", {
      id: { 
        type: DataTypes.UUID, 
        defaultValue: DataTypes.UUIDV4, 
        primaryKey: true 
      },
      userId: { 
        type: DataTypes.STRING(36), 
        allowNull: false 
      },
      text: { 
        type: DataTypes.STRING(255), 
        allowNull: false 
      },
      deviceToken: { 
        type: DataTypes.STRING(255), 
        allowNull: true 
      },
      timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      }
    });
  
    Notification.associate = models => {
      Notification.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
    };
  
    return Notification;
  };
  