module.exports = (sequelize, DataTypes) => {
    const CabBookingAccepted = sequelize.define("CabBookingAccepted", {
      bookingId: { 
        type: DataTypes.STRING(36), 
        primaryKey: true 
      },
      driverid: { 
        type: DataTypes.STRING(36), 
        allowNull: false 
      },
      acceptedAt: { 
        type: DataTypes.DATE, 
        allowNull: false 
      },
    });
  
    CabBookingAccepted.associate = (models) => {
      CabBookingAccepted.belongsTo(models.CabBookingRequest, { foreignKey: "bookingId" });
      CabBookingAccepted.belongsTo(models.Driver, { foreignKey: "driverId" });
    };
  
    return CabBookingAccepted;
  };
  