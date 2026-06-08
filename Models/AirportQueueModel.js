module.exports = (sequelize, DataTypes) => {
  const AirportQueue = sequelize.define("AirportQueue", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    driverId: {
      type: DataTypes.STRING(36),
      allowNull: false,
      unique: true, // Driver can join only one queue at a time
    },
    airportCode: {
      type: DataTypes.STRING(10), // e.g. "BLR", "CCU", "HYD"
      allowNull: false,
    },
    queuePosition: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("waiting", "offered", "completed"),
      defaultValue: "waiting",
      allowNull: false,
    },
  });

  return AirportQueue;
};
