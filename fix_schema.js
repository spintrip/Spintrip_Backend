const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Manually load .env
const envPath = path.join(__dirname, '.env');
const envConfig = fs.readFileSync(envPath, 'utf8');
envConfig.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key.trim()] = value.trim().replace(/^['"]|['"]$/g, '');
  }
});

const sequelize = new Sequelize(`postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`, {
  dialect: 'postgres',
  logging: false,
});

async function fixSchema() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    const queryInterface = sequelize.getQueryInterface();
    const tableInfo = await queryInterface.describeTable('UserAdditionals');

    if (!tableInfo.PanVfid) {
      console.log('Adding column PanVfid...');
      await queryInterface.addColumn('UserAdditionals', 'PanVfid', {
        type: DataTypes.STRING(10),
        allowNull: true
      });
    }

    if (!tableInfo.pan) {
      console.log('Adding column pan...');
      await queryInterface.addColumn('UserAdditionals', 'pan', {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    console.log('Schema update completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error updating schema:', error);
    process.exit(1);
  }
}

fixSchema();
