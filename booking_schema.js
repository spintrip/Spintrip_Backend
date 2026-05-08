const db = require('./Models/index.js');
async function runPatch() {
  try {
    console.log('Adding "days" column to CabBookingRequests...');
    await db.sequelize.query('ALTER TABLE "CabBookingRequests" ADD COLUMN IF NOT EXISTS "days" INTEGER DEFAULT 1;');
    
    console.log('Adding "isRoundTrip" column to CabBookingRequests...');
    await db.sequelize.query('ALTER TABLE "CabBookingRequests" ADD COLUMN IF NOT EXISTS "isRoundTrip" BOOLEAN DEFAULT TRUE;');
    
    console.log('Successfully patched CabBookingRequests schema.');
  } catch (error) {
    console.error('Error patching schema:', error);
  } finally {
    process.exit(0);
  }
}
runPatch();