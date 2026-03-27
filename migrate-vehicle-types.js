require('dotenv').config();
const { sequelize } = require('./Models');

async function migrate() {
  try {
    console.log("Starting migration...");
    
    // 1. Change cabType from ENUM to VARCHAR in HostCabRateCards
    // We first check if it's an enum and change it to text/varchar
    await sequelize.query(`ALTER TABLE "HostCabRateCards" ALTER COLUMN "cabType" TYPE VARCHAR(255);`);
    console.log("Changed HostCabRateCards.cabType to VARCHAR.");

    // 2. Sync VehicleType model to create the table
    const { VehicleType } = require('./Models');
    await VehicleType.sync();
    console.log("VehicleTypes table synchronized.");

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
