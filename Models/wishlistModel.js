module.exports = (sequelize, DataTypes) => {
  const Wishlist = sequelize.define("Wishlist", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userid: {type: DataTypes.STRING(36)},
    vehicleid: { type: DataTypes.STRING(36)},
  });

  return Wishlist;
};
