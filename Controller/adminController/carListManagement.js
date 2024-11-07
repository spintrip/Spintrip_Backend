const { Car, CarAdditional, Listing } = require('../../Models');

// Get all cars with additional information
const getAllCars = async (req, res) => {
  try {
    const cars = await Car.findAll();
    const carsWithAdditionalInfo = await Promise.all(
      cars.map(async (car) => {
        const additionalInfo = await CarAdditional.findOne({ where: { carid: car.carid } });
        return {
          ...car.toJSON(),
          additionalInfo: additionalInfo ? additionalInfo.toJSON() : null,
        };
      })
    );

    res.status(200).json({ message: "All available cars", cars: carsWithAdditionalInfo });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching cars', error });
  }
};

// Get a car by ID with additional information
const getCarById = async (req, res) => {
  try {
    const car = await Car.findByPk(req.params.id);
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    const additionalInfo = await CarAdditional.findOne({ where: { carid: car.carid } });
    res.status(200).json({
      car: {
        ...car.toJSON(),
        additionalInfo: additionalInfo ? additionalInfo.toJSON() : null,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching car', error });
  }
};

// Update a car by ID
const updateCarById = async (req, res) => {
  try {
    const { carid } = req.params;
    const { additionalInfo, ...carData } = req.body;

    const [updated] = await Car.update(carData, { where: { carid } });
    if (!updated) {
      return res.status(404).json({ message: 'Car not found' });
    }

    if (additionalInfo) {
      let additionalRecord = await CarAdditional.findOne({ where: { carid } });
      if (additionalRecord) {
        await additionalRecord.update(additionalInfo);
      }
    }

    const updatedCar = await Car.findByPk(carid);
    const updatedAdditionalInfo = await CarAdditional.findOne({ where: { carid } });

    res.status(200).json({
      message: 'Car updated successfully',
      car: {
        ...updatedCar.toJSON(),
        additionalInfo: updatedAdditionalInfo ? updatedAdditionalInfo.toJSON() : null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating car', error });
  }
};

// Delete a car by ID
const deleteCarById = async (req, res) => {
  try {
    await Car.destroy({ where: { carid: req.params.id } });
    res.status(200).json({ message: 'Car deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting car', error });
  }
};

// Get all listings
const getAllListings = async (req, res) => {
  try {
    const listings = await Listing.findAll();
    res.status(200).json({ message: 'All available listings', listings });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching listings', error });
  }
};

// Get a listing by ID
const getListingById = async (req, res) => {
  try {
    const listing = await Listing.findByPk(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }
    res.status(200).json({ listing });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching listing', error });
  }
};

// Update a listing by ID
const updateListingById = async (req, res) => {
  try {
    const listing = await Listing.update(req.body, { where: { id: req.params.id } });
    res.status(200).json({ message: 'Listing updated successfully', listing });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error updating listing', error });
  }
};

// Delete a listing by ID
const deleteListingById = async (req, res) => {
  try {
    await Listing.destroy({ where: { id: req.params.id } });
    res.status(200).json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting listing', error });
  }
};

module.exports = { 
  getAllCars, 
  getCarById, 
  updateCarById, 
  deleteCarById, 
  getAllListings, 
  getListingById, 
  updateListingById, 
  deleteListingById 
};
