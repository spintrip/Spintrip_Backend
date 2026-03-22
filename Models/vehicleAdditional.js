module.exports = (sequelize, DataTypes) => {
  const VehicleAdditional = sequelize.define(
    "VehicleAdditional",
    {
      vehicleid: {
        type: DataTypes.STRING(36),
        primaryKey: true,
        references: {
          model: "Vehicles", // Table name for Vehicle
          key: "vehicleid", // Column in Vehicle model
        },
        onDelete: "CASCADE",
      },
      Additionalinfo: DataTypes.TEXT,
      vehicleimage1: DataTypes.STRING,
      vehicleimage2: DataTypes.STRING,
      vehicleimage3: DataTypes.STRING,
      vehicleimage4: DataTypes.STRING,
      vehicleimage5: DataTypes.STRING,
      verification_status: DataTypes.INTEGER,
      latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },

      address: DataTypes.TEXT,
      timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      timestamps: true, // Adds createdAt and updatedAt
      indexes: [
        {
          name: "timestamp_index",
          fields: ["timestamp"],
        },

      ],
      hooks: {
        beforeSave: (vehicleAdditional, options) => {
          // Temporarily removed PostGIS geometries
        },
      },
    }
  );

  return VehicleAdditional;
};
