const { HostCabRateCard } = require('./Models');
async function run() {
  try {
    const cards = await HostCabRateCard.findAll({
      order: [['updatedAt', 'DESC']],
      limit: 10
    });
    console.log(JSON.stringify(cards, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
