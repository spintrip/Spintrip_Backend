module.exports = (sequelize, DataTypes) => {
    const CabToDriver = sequelize.define("CabToDriver", {
      vehicleid: { 
        type: DataTypes.STRING(36), 
        primaryKey: true 
      },
      driverid: { 
        type: DataTypes.STRING(36) 
      },
      assignedAt: { 
        type: DataTypes.DATE, 
        allowNull: false 
      },
    });
  
    CabToDriver.associate = (models) => {
      CabToDriver.belongsTo(models.Driver, { foreignKey: "driverid" });
      CabToDriver.belongsTo(models.Vehicle, { foreignKey: "vehicleid" });
    };
  
    return CabToDriver;
  };
  