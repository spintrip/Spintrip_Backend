const { Sequelize, DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const AppSetting = sequelize.define("AppSetting", {
    key: { 
      type: DataTypes.STRING, 
      primaryKey: true 
    },
    value: { 
      type: DataTypes.STRING, 
      allowNull: false 
    }
  });
  return AppSetting;
};
