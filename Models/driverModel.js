module.exports = (sequelize, DataTypes) => {
    const Driver = sequelize.define("Driver", {
      id: { type: DataTypes.STRING(36), primaryKey: true },
      onlyVerifiedUsers: { type: DataTypes.BOOLEAN, defaultValue: false } // New field to enable only verified users
    });
    return Host;
  };