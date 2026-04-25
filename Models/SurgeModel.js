module.exports = (sequelize, DataTypes) => {
  const SurgePrice = sequelize.define("SurgePrice", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true, // Use null for "All Cities"
    },
    cabType: {
      type: DataTypes.STRING,
      allowNull: true, // Use null for "All Types"
    },
    multiplier: {
      type: DataTypes.DOUBLE,
      defaultValue: 1.0,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.TIME, // 'HH:mm:ss'
      allowNull: false,
    },
    endTime: {
      type: DataTypes.TIME, // 'HH:mm:ss'
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATEONLY, // Special holiday surges
      allowNull: true,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    daysOfWeek: {
      type: DataTypes.STRING, // Comma separated: '1,2,3,4,5' (Sun=0)
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    timestamps: true,
  });

  return SurgePrice;
};
