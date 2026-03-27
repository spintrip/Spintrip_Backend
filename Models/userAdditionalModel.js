module.exports = (sequelize, DataTypes) => {
    const UserAdditional = sequelize.define("UserAdditional", {
      id: { type: DataTypes.STRING(36), primaryKey: true },
      Dlverification: DataTypes.STRING(16),
      FullName: DataTypes.STRING(100),
      Email: DataTypes.STRING,
      AadharVfid: DataTypes.STRING(12),
      PanVfid: DataTypes.STRING(10),
      Address: DataTypes.TEXT,
      verification_status: DataTypes.INTEGER,
      CurrentAddressVfid: { type: DataTypes.STRING, unique: true },
      ml_data: DataTypes.BLOB,
      profilepic: DataTypes.STRING,
      dl: DataTypes.STRING,
      aadhar: DataTypes.STRING,
      pan: DataTypes.STRING

    });

  
    return UserAdditional;
  };
  