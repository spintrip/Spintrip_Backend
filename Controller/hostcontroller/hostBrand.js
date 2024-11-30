const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const getBrand = async (req, res) => {
    try {
      const brands = [];
      const csvFilePath = path.join(__dirname, '..', 'data', 'brands.csv');
  
      // Check if the file exists
      if (!fs.existsSync(csvFilePath)) {
        console.log(`File not found: ${csvFilePath}`);
        return res.status(404).json({ message: 'No brands found' });
      }
      console.log(`Reading file: ${csvFilePath}`);
      let brand;
      fs.createReadStream(csvFilePath)
        .pipe(csv({ headers: false }))
        .on('data', (row) => {
          if (row[1]) {
            brand = {
              brand_name: row[0],
              logo_path:  row[1]
            };
          }
          else {
            brand = {
              brand_name: row[0],
              logo_path: null
            };
  
          }
          console.log(`Read row: ${JSON.stringify(brand)}`);
          brands.push(brand);
        })
        .on('end', () => {
          res.status(200).json({ brands });
        })
        .on('error', (error) => {
          console.error(`Error reading file: ${error}`);
          res.status(500).json({ message: 'Error reading CSV file', error });
        });
    } catch (error) {
      console.error(`Error in try-catch: ${error}`);
      res.status(500).json({ message: 'Error fetching brands', error });
    }
  };
  module.exports = {getBrand};