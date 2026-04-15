module.exports = (sequelize, DataTypes) => {
    const Support = sequelize.define("Support", {
      id: { type: DataTypes.STRING(36), primaryKey: true },
      userId: { type: DataTypes.STRING(36) },
      subject: { 
        type: DataTypes.STRING, 
        allowNull: false 
      },
      message: { 
        type: DataTypes.TEXT, 
        allowNull: false 
      },
      status: { 
        type: DataTypes.STRING, 
        defaultValue: 'open' 
      },
      category: {
        type: DataTypes.STRING,
        defaultValue: 'general'
      },
      bookingId: {
        type: DataTypes.STRING(36),
        allowNull: true
      },
      vehicleId: {
        type: DataTypes.STRING(36),
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true
      },
      priority: { 
        type: DataTypes.INTEGER, 
        defaultValue: 1 
      },
      escalations: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0 
      },
    });
    return Support;
  };
  