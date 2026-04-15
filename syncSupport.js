const db = require('./Models');

(async () => {
  try {
    console.log("Syncing Support Model...");
    await db.Support.sync({ alter: true });
    
    console.log("Syncing SupportChat Model...");
    await db.SupportChat.sync({ alter: true });
    
    console.log("Successfully synced all support tables.");
    process.exit(0);
  } catch (error) {
    console.error("Error syncing tables:", error);
    process.exit(1);
  }
})();
