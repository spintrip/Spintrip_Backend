module.exports = (sequelize, DataTypes) => {
  const Listing = sequelize.define("Listing", {
    id: {
      type: DataTypes.STRING(36),
      primaryKey: true,
    },
    vehicleid: { // Renamed from carid
      type: DataTypes.STRING(36),
      allowNull: false,
    },
    hostid: {
      type: DataTypes.STRING(36),
    },
    details: {
      type: DataTypes.STRING,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    pausetime_start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    pausetime_end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    pausetime_start_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    pausetime_end_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    listingid: {
      type: DataTypes.STRING(36),
      allowNull: true,
    },
    hourcount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        isInt: true,
        min: 0,
      },
    },
    bookingId: {
      type: DataTypes.STRING(36),
      allowNull: true,
    },
  });

  return Listing;
};
