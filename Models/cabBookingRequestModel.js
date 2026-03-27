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
        type: DataTypes.ENUM("pending_payment", "pending", "accepted", "started", "completed", "cancelled", "rated"), 
        defaultValue: "pending_payment" 
      },
      startTripTime: DataTypes.TIME,
      endTripTime: DataTypes.TIME,
      startLocationLatitude: DataTypes.FLOAT,
      startLocationLongitude: DataTypes.FLOAT,
      endLocationLatitude: DataTypes.FLOAT,
      endLocationLongitude: DataTypes.FLOAT,
      startLocationAddress: DataTypes.TEXT,
      endLocationAddress: DataTypes.TEXT,
      estimatedPrice: DataTypes.FLOAT,
      subtotalBasePrice: { type: DataTypes.FLOAT, defaultValue: 0 },
      gstAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
      commissionAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
      tdsAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
      driverEarnings: { type: DataTypes.FLOAT, defaultValue: 0 },
      finalPrice: DataTypes.FLOAT,
      otp: DataTypes.INTEGER, // OTP for trip initiation
      cabType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bookingType: {
        type: DataTypes.ENUM("Daily", "Local", "Rentals", "Outstation", "Airport"),
        defaultValue: "Local",
      },
      paymentStatus: {
        type: DataTypes.ENUM("pending", "paid", "failed"),
        defaultValue: "pending",
      },
      amountPaid: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0,
      },
    });
  
    CabBookingRequest.associate = (models) => {
      CabBookingRequest.belongsTo(models.Vehicle, { foreignKey: "vehicleId" });
      CabBookingRequest.belongsTo(models.Driver, { foreignKey: "driverId" });
    };
  
    return CabBookingRequest;
  };
  