module.exports = (sequelize, DataTypes) => {
  const Vehicle = sequelize.define("Vehicle", {
    vehicleid: { type: DataTypes.STRING(36), primaryKey: true },
    vehicletype: DataTypes.STRING,
    chassisno: DataTypes.STRING,
    Rcnumber: DataTypes.STRING,
    Enginenumber: DataTypes.STRING,
    Registrationyear: DataTypes.DATEONLY, 
    timestamp: DataTypes.DATE,
    rating: DataTypes.FLOAT,
    hostId: {
      type: DataTypes.STRING(36),
      references: {
        model: 'Hosts', // This should match the table name for Hosts
        key: 'id'
      }
    }
  })

  return Vehicle;
};
