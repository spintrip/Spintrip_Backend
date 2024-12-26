module.exports = (sequelize, DataTypes) => {
  const Car = sequelize.define("Car", {
    carmodel: DataTypes.STRING,
    HorsePower: DataTypes.INTEGER, 
    type: DataTypes.STRING,
    brand: DataTypes.STRING,
    variant: DataTypes.STRING,
    color: DataTypes.STRING,
    bodytype: DataTypes.STRING,
    HorsePower: DataTypes.INTEGER, 
    AC: DataTypes.BOOLEAN,
    Musicsystem: DataTypes.BOOLEAN,
    Autowindow: DataTypes.BOOLEAN,
    Sunroof: DataTypes.BOOLEAN,
    Touchscreen: DataTypes.BOOLEAN,
    Sevenseater: DataTypes.BOOLEAN,
    Reversecamera: DataTypes.BOOLEAN,
    Transmission: DataTypes.BOOLEAN,
    Airbags: DataTypes.BOOLEAN,
    FuelType: DataTypes.INTEGER,
    PetFriendly: DataTypes.BOOLEAN,
    PowerSteering: DataTypes.BOOLEAN,
    ABS: DataTypes.BOOLEAN,
    tractionControl: DataTypes.BOOLEAN,
    fullBootSpace:  DataTypes.BOOLEAN,
    KeylessEntry: DataTypes.BOOLEAN,
    airPurifier: DataTypes.BOOLEAN,
    cruiseControl: DataTypes.BOOLEAN,
    voiceControl: DataTypes.BOOLEAN,
    usbCharger: DataTypes.BOOLEAN,
    bluetooth: DataTypes.BOOLEAN,
    airFreshner: DataTypes.BOOLEAN,
    ventelatedFrontSeat: DataTypes.BOOLEAN,
    vehicleid: { type: DataTypes.STRING(36), primaryKey: true },
    timestamp: DataTypes.DATE,
    rating: DataTypes.FLOAT,
    city: DataTypes.STRING,
    hostId: {
      type: DataTypes.STRING(36),
      references: {
        model: 'Hosts', // This should match the table name for Hosts
        key: 'id'
      }
    }
  })

  return Car;
};
