
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("User", {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    phone: { type: DataTypes.STRING(20), unique: true },
    password: DataTypes.STRING(100),
    role: DataTypes.STRING(50),
    otp:DataTypes.STRING(100),
    timestamp: DataTypes.DATE,
    status:DataTypes.INTEGER,
    rating: DataTypes.FLOAT,
    deviceToken: DataTypes.STRING,
    fcmToken: DataTypes.STRING, 
    referralCode: { type: DataTypes.STRING(8), unique: true },
    referredBy: { type: DataTypes.STRING(36) },
    referralCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  });

  return User;
};
