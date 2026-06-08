const { Cab } = require('c:/Users/Admin/Spintrip New Vision/SpinTrip_Backend/Models');

async function inspectCab() {
  try {
    const cab = await Cab.findOne({
      where: { driverId: '6a491359-30f3-4a9e-ac7b-61d42185b2d0' },
      raw: true
    });
    console.log("=== Driver's Cab row ===");
    console.log(JSON.stringify(cab, null, 2));

    const allCabs = await Cab.findAll({
      limit: 10,
      raw: true
    });
    console.log("=== All Cabs in DB ===");
    console.log(JSON.stringify(allCabs, null, 2));
  } catch (err) {
    console.error("Error inspecting Cab:", err);
  }
  process.exit(0);
}

inspectCab();
