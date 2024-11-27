module.exports = (sequelize, DataTypes) => {
    const DriverKeepAlive = sequelize.define("DriverKeepAlive", {
      driverId: { 
        type: DataTypes.STRING(36), 
        primaryKey: true 
      },
      lastPingTime: { 
        type: DataTypes.DATE, 
        allowNull: false 
      },
      isActive: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: true 
      },
    });
  
    DriverKeepAlive.associate = (models) => {
      DriverKeepAlive.belongsTo(models.Driver, { foreignKey: "driverid" });
    };
  
    return DriverKeepAlive;
  };
  