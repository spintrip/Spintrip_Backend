module.exports = (sequelize, DataTypes) => {
    const HostAdditional = sequelize.define("HostAdditional", {
      id: { type: DataTypes.STRING(36), primaryKey: true },
      GSTnumber: DataTypes.STRING(16),
      PANnumber: DataTypes.STRING(16),
      FullName: DataTypes.STRING(100),
      Email: DataTypes.STRING,
      AadharVfid: DataTypes.STRING(12),
      Address: DataTypes.TEXT,   
      businessName: DataTypes.STRING(100),
      verification_status: DataTypes.INTEGER,
      CurrentAddressVfid: { type: DataTypes.STRING, unique: true },
      ml_data: DataTypes.BLOB,
      profilepic: DataTypes.STRING,
      aadhar: DataTypes.STRING,
      pan: DataTypes.STRING // 🖼️ Added for PAN photo storage
    });

  
    return HostAdditional;
  };
  