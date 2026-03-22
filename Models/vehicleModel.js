module.exports = (sequelize, DataTypes) => {
  const Vehicle = sequelize.define("Vehicle", {
    vehicleid: { type: DataTypes.STRING(36), primaryKey: true },
    vehicletype: DataTypes.STRING,
    chassisno: DataTypes.STRING,
    Rcnumber: DataTypes.STRING,
    RcImage: DataTypes.STRING,
    PucImage: DataTypes.STRING,
    Enginenumber: DataTypes.STRING,
    Registrationyear: DataTypes.DATEONLY, 
    timestamp: DataTypes.DATE,
    rating: DataTypes.FLOAT,
    activated: { type: DataTypes.BOOLEAN, defaultValue: false }, // New field to indicate activation status
    hostId: {
      type: DataTypes.STRING(36),
      references: {
        model: 'Hosts', // This should match the table name for Hosts
        key: 'id'
      }
    }
  });

  Vehicle.associate = (models) => {
    Vehicle.belongsTo(models.Host, { foreignKey: 'hostId' });
  };

  return Vehicle;
};