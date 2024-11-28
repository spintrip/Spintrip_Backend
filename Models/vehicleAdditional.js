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
      location: {
        type: DataTypes.GEOGRAPHY("POINT"),
        allowNull: true, // Computed from latitude/longitude
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
        {
          name: "location_index",
          fields: ["location"], // Add index for spatial queries
          using: "gist",
        },
      ],
      hooks: {
        beforeSave: (vehicleAdditional, options) => {
          // Automatically update `location` based on `latitude` and `longitude`
          if (vehicleAdditional.latitude && vehicleAdditional.longitude) {
            vehicleAdditional.location = sequelize.literal(
              `ST_SetSRID(ST_MakePoint(${vehicleAdditional.longitude}, ${vehicleAdditional.latitude}), 4326)`
            );
          }
        },
      },
    }
  );

  return VehicleAdditional;
};
