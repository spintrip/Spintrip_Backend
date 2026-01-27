module.exports = (sequelize, DataTypes) => {
    const UserAddress = sequelize.define("UserAddress", {
      id: {
        type: DataTypes.STRING(36),
        primaryKey: true,
      },
      userid: {
        type: DataTypes.STRING(36),
        primaryKey: false,
      },
      fullAddress: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      latitude: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      longitude: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
    });
  
    return UserAddress;
  };
  