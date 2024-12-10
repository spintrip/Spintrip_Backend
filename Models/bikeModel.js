module.exports = (sequelize, DataTypes) => {
  const Bike = sequelize.define("Bike", {
    bikemodel: DataTypes.STRING,
    HorsePower: DataTypes.INTEGER, 
    type: DataTypes.STRING,
    brand: DataTypes.STRING,
    variant: DataTypes.STRING,
    color: DataTypes.STRING,
    bodytype: DataTypes.STRING,
    helmet: DataTypes.BOOLEAN,
    helmetSpace: DataTypes.BOOLEAN,
    vehicleid: { type: DataTypes.STRING(36), primaryKey: true },
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

  return Bike;
};
