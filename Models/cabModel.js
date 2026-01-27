module.exports = (sequelize, DataTypes) => {
    const Cab = sequelize.define("Cab", {
      model: DataTypes.STRING,
      type: DataTypes.STRING,
      brand: DataTypes.STRING,
      variant: DataTypes.STRING,
      color: DataTypes.STRING,
      bodytype: DataTypes.STRING,
      FuelType: DataTypes.INTEGER,
      seatingCapacity: DataTypes.INTEGER,
      luggageCapacity: DataTypes.INTEGER,
      permitNumber: DataTypes.STRING,
      vehicleid: { type: DataTypes.STRING(36), primaryKey: true },
      driverId: DataTypes.STRING(36), 
      timestamp: DataTypes.DATE,
      city: DataTypes.STRING,
      hostId: {
        type: DataTypes.STRING(36),
        references: {
          model: 'Hosts', // This should match the table name for Hosts
          key: 'id'
        }
      }
    })
  
    return Cab;
  };
  