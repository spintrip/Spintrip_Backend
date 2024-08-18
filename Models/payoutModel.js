// models/Payout.js

module.exports = (sequelize, DataTypes) => {
    const Payout = sequelize.define('Payout', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.STRING(36),
        allowNull: false,
      },
      bookingIds: {
        type: DataTypes.JSON, // Storing list of booking IDs as JSON
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      modeOfPayment: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    });
  
    Payout.associate = (models) => {
      Payout.belongsTo(models.User, { foreignKey: 'userId' });
    };
  
    return Payout;
  };
  