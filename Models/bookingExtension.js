module.exports = (sequelize, DataTypes) => {
  const BookingExtension = sequelize.define("BookingExtension", {
    bookingId: {
      type: DataTypes.STRING(36),
      primaryKey: true,
      allowNull: false,
    },
    extendedBookings: {
      type: DataTypes.JSONB, // Stores the list of booking IDs related to extensions
      allowNull: false,
      defaultValue: [],
    },
  });

  return BookingExtension;
};
