require('dotenv').config();
const { Pricing, Tax, Vehicle } = require('./Models');

async function debugPricing(vehicleId) {
  try {
    const pricing = await Pricing.findOne({ where: { vehicleid: vehicleId } });
    const tax = await Tax.findOne({ where: { id: 1 } });
    const vehicle = await Vehicle.findByPk(vehicleId);

    console.log("--- DEBUG PRICING ---");
    console.log("Vehicle ID:", vehicleId);
    console.log("Vehicle Type:", vehicle?.vehicletype);
    console.log("Pricing:", pricing ? JSON.stringify(pricing.toJSON(), null, 2) : "NOT FOUND");
    console.log("Tax/Commission Settings:", tax ? JSON.stringify(tax.toJSON(), null, 2) : "NOT FOUND");
    
    // Test calculation for 24 hours
    if (pricing) {
        const hours = 24;
        const amount = Math.round(pricing.costperhr * hours);
        console.log(`Calculation for 24 hours: ${pricing.costperhr} * ${hours} = ${amount}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error debugging pricing:", error);
    process.exit(1);
  }
}

const vehicleId = process.argv[2] || 'f5d7f6d2-df38-4b3c-9425-79bf9989a6fe';
debugPricing(vehicleId);
