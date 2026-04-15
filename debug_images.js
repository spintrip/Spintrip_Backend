require('dotenv').config();
const { Vehicle, VehicleAdditional } = require('./Models');

async function debugImages(vehicleId) {
  try {
    const vehicle = await Vehicle.findByPk(vehicleId);
    const vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: vehicleId } });

    console.log("--- DEBUG VEHICLE IMAGES ---");
    console.log("Vehicle ID:", vehicleId);
    console.log("Vehicle:", vehicle ? vehicle.toJSON() : "NOT FOUND");
    console.log("VehicleAdditional:", vehicleAdditional ? vehicleAdditional.toJSON() : "NOT FOUND");
    
    process.exit(0);
  } catch (error) {
    console.error("Error debugging images:", error);
    process.exit(1);
  }
}

const vehicleId = process.argv[2] || 'f5d7f6d2-df38-4b3c-9425-79bf9989a6fe';
debugImages(vehicleId);
