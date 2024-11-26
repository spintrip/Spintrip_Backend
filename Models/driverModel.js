module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define("Driver", {
    id: {
      type: DataTypes.STRING(36),
      primaryKey: true,
    },
    hostid: {
      type: DataTypes.STRING(36),
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    details: {
      type: DataTypes.JSON, // Can hold additional driver metadata (e.g., license number, experience)
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // Tracks if the driver is actively available for trips
    },
    lastPingTime: {
      type: DataTypes.DATE,
      allowNull: true, // Timestamp of the last keep-alive ping
    },
    pausetime_start_date: DataTypes.DATEONLY,
    pausetime_end_date: DataTypes.DATEONLY,
    pausetime_start_time: DataTypes.TIME,
    pausetime_end_time: DataTypes.TIME,
  });

  return Driver;
};
