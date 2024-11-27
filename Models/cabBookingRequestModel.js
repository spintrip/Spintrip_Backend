module.exports = (sequelize, DataTypes) => {
    const CabBookingRequest = sequelize.define("CabBookingRequest", {
      bookingId: { 
        type: DataTypes.STRING(36), 
        primaryKey: true 
      },
      userId: { 
        type: DataTypes.STRING(36), 
        allowNull: false 
      },
      vehicleId: DataTypes.STRING(36),  
      driverid: DataTypes.STRING(36),
      date: DataTypes.DATEONLY,
      time: DataTypes.TIME,
      status: { 
        type: DataTypes.ENUM("pending", "accepted", "started", "completed", "cancelled"), 
        defaultValue: "pending" 
      },
      startTripTime: DataTypes.TIME,
      endTripTime: DataTypes.TIME,
      startLocationLatitude: DataTypes.FLOAT,
      startLocationLongitude: DataTypes.FLOAT,
      endLocationLatitude: DataTypes.FLOAT,
      endLocationLongitude: DataTypes.FLOAT,
      estimatedPrice: DataTypes.FLOAT,
      finalPrice: DataTypes.FLOAT,
      otp: DataTypes.INTEGER, // OTP for trip initiation
    });
  
    CabBookingRequest.associate = (models) => {
      CabBookingRequest.belongsTo(models.Vehicle, { foreignKey: "vehicleId" });
      CabBookingRequest.belongsTo(models.Driver, { foreignKey: "driverId" });
    };
  
    return CabBookingRequest;
  };
  