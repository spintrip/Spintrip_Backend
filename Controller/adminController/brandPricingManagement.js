const { Brand, Pricing } = require('../../Models');

// Create or update a brand
const createOrUpdateBrand = async (req, res) => {
  try {
    const { type, brand, carmodel, brand_value, base_price } = req.body;

    // Check if the brand already exists
    const existingBrand = await Brand.findOne({
      where: { type, brand, carmodel },
    });

    if (existingBrand) {
      // Update the existing brand
      await existingBrand.update({ brand_value, base_price });
      return res.status(200).json({ message: 'Brand updated successfully', brand: existingBrand });
    } else {
      // Create a new brand
      const newBrand = await Brand.create({ type, brand, carmodel, brand_value, base_price });
      return res.status(201).json({ message: 'Brand created successfully', brand: newBrand });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating or updating brand', error });
  }
};

// Get all brands
const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.findAll();
    res.status(200).json({ message: 'All available brands', brands });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching brands', error });
  }
};

// Update a brand by ID
const updateBrandById = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, brand, carmodel, brand_value, base_price } = req.body;

    const existingBrand = await Brand.findByPk(id);
    if (!existingBrand) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    await existingBrand.update({ type, brand, carmodel, brand_value, base_price });
    res.status(200).json({ message: 'Brand updated successfully', brand: existingBrand });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating brand', error });
  }
};

// Get pricing information
const getPricing = async (req, res) => {
  try {
    const pricing = await Pricing.findAll();
    res.status(200).json({ message: 'All pricing information', pricing });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching pricing', error });
  }
};

// Update pricing by car ID
const updatePricingById = async (req, res) => {
  try {
    const { vehicleid } = req.params;
    const { 
      costperhr, 
      pricingType, 
      priceperkm, 
      fixedPrice, 
      packagePrice, 
      baseKm, 
      extraKmPrice 
    } = req.body;

    const pricing = await Pricing.findOne({ where: { vehicleid } });
    if (!pricing) {
      return res.status(404).json({ message: 'Pricing record not found' });
    }

    await pricing.update({ 
      costperhr, 
      pricingType, 
      priceperkm, 
      fixedPrice, 
      packagePrice, 
      baseKm, 
      extraKmPrice 
    });
    
    res.status(200).json({ message: 'Pricing updated successfully', pricing });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating pricing', error });
  }
};

module.exports = { createOrUpdateBrand, getAllBrands, updateBrandById, getPricing, updatePricingById };
