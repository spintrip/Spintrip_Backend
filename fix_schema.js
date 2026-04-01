/* fix_schema.js */
const db = require('./Models');
const { DataTypes } = require('sequelize');

async function runFix() {
  const sequelize = db.sequelize;
  const queryInterface = sequelize.getQueryInterface();
  
  try {
    console.log('--- STARTING DATABASE SCHEMA FIX ---');
    await sequelize.authenticate();
    console.log('Database connected.');

    // 1. Patch Users Table (Referral Logic)
    const usersTable = await queryInterface.describeTable('Users');
    if (!usersTable.referralCode) {
      console.log('➜ Adding referral columns to "Users"...');
      await queryInterface.addColumn('Users', 'referralCode', { type: DataTypes.STRING(8), unique: true });
      await queryInterface.addColumn('Users', 'referredBy', { type: DataTypes.STRING(36) });
      await queryInterface.addColumn('Users', 'referralCount', { type: DataTypes.INTEGER, defaultValue: 0 });
    }

    // 2. Patch CabBookingRequests (Payment Segregation for App)
    console.log('➜ Adding financial columns to "CabBookingRequests"...');
    await sequelize.query(`ALTER TABLE "CabBookingRequests" ADD COLUMN IF NOT EXISTS "confirmationFee" FLOAT DEFAULT 0.0;`);
    await sequelize.query(`ALTER TABLE "CabBookingRequests" ADD COLUMN IF NOT EXISTS "payToDriver" FLOAT DEFAULT 0.0;`);

    // 3. Patch HostCabRateCards (Local & Airport Rates for Payout Formulas)
    console.log('➜ Adding extra rates to "HostCabRateCards"...');
    await sequelize.query(`ALTER TABLE "HostCabRateCards" ADD COLUMN IF NOT EXISTS "localExtraKmRate" FLOAT DEFAULT 0.0;`);
    await sequelize.query(`ALTER TABLE "HostCabRateCards" ADD COLUMN IF NOT EXISTS "airportExtraKmRate" FLOAT DEFAULT 0.0;`);

    // 4. Create/Sync ReferralReward Table
    console.log('➜ Syncing "ReferralReward" table hierarchy...');
    await db.ReferralReward.sync({ alter: true });

    console.log('\n✅ DATABASE UPGRADE SUCCESSFUL');
    console.log('Summary of changes:');
    console.log('- Users: Referral codes and tracking added.');
    console.log('- CabBookingRequests: Finance segregation (confirmationFee, payToDriver) enabled.');
    console.log('- HostCabRateCards: Detailed extra KM rates unlocked.');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ SCHEMA FIX FAILED:', error.message);
    process.exit(1);
  }
}

runFix();
