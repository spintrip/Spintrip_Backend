const { sequelize } = require('./Models');
const { DataTypes } = require('sequelize');

async function migrate() {
  const queryInterface = sequelize.getQueryInterface();
  const tableName = 'Taxes';

  try {
    const tableInfo = await queryInterface.describeTable(tableName);

    if (!tableInfo.HostGST) {
      console.log('Adding HostGST column...');
      await queryInterface.addColumn(tableName, 'HostGST', {
        type: DataTypes.DECIMAL,
        allowNull: true,
        defaultValue: 0.0
      });
    }

    if (!tableInfo.Commission) {
      console.log('Adding Commission column...');
      await queryInterface.addColumn(tableName, 'Commission', {
        type: DataTypes.DECIMAL,
        allowNull: true,
        defaultValue: 0.0
      });
    }

    if (!tableInfo.insurance) {
      console.log('Adding insurance column...');
      await queryInterface.addColumn(tableName, 'insurance', {
        type: DataTypes.DECIMAL,
        allowNull: true,
        defaultValue: 0.0
      });
    }

    console.log('Migration successful!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
