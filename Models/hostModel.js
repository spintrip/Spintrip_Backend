module.exports = (sequelize, DataTypes) => {
  const Host = sequelize.define("Host", {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    parentHostId: { type: DataTypes.STRING(36), allowNull: true }, // For sub-hosts
    //hostType: { type: DataTypes.STRING(36), allowNull: true }, 
    onlyVerifiedUsers: { type: DataTypes.BOOLEAN, defaultValue: false } // New field to enable only verified users
  });

  return Host;
};