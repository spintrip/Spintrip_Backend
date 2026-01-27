module.exports = (sequelize, DataTypes) => {
    const DriverAdditional = sequelize.define("DriverAdditional", {
      id: { type: DataTypes.STRING(36), primaryKey: true },
      FullName: DataTypes.STRING(100),
      Email: DataTypes.STRING,
      AadharVfid: DataTypes.STRING(12),
      Address: DataTypes.TEXT,   
      businessName: DataTypes.STRING(100),
      profilepic: DataTypes.STRING,
      aadhar: DataTypes.STRING
    });

  
    return DriverAdditional;
  };
  