const { Tax, Feature } = require('../../Models');

// Create a new tax record
const createTax = async (req, res) => {
  try {
    const { GST, HostGST, TDS, Commission, insurance } = req.body;

    const newTax = await Tax.create({
      GST,
      HostGST,
      TDS,
      Commission,
      insurance,
    });

    res.status(201).json({ message: 'Tax created successfully', newTax });
  } catch (error) {
    console.error('Error creating tax:', error.message);
    res.status(500).json({ message: 'Error creating tax', error });
  }
};

// Get all tax records
const getAllTaxes = async (req, res) => {
  try {
    const taxes = await Tax.findAll();
    if (taxes.length === 0) {
      return res.status(404).json({ message: 'No tax records found' });
    }
    res.status(200).json({ message: 'Taxes retrieved successfully', taxes });
  } catch (error) {
    console.error('Error fetching taxes:', error.message);
    res.status(500).json({ message: 'Error fetching taxes', error });
  }
};

// Update a tax record by ID
const updateTaxById = async (req, res) => {
  try {
    const { id } = req.params;
    const { GST, HostGST, TDS, Commission, insurance } = req.body;

    const tax = await Tax.findByPk(id);
    if (!tax) {
      return res.status(404).json({ message: 'Tax record not found' });
    }

    await tax.update({
      GST: GST !== undefined ? GST : tax.GST,
      HostGST: HostGST !== undefined ? HostGST : tax.HostGST,
      TDS: TDS !== undefined ? TDS : tax.TDS,
      Commission: Commission !== undefined ? Commission : tax.Commission,
      insurance: insurance !== undefined ? insurance : tax.insurance,
    });

    res.status(200).json({ message: 'Tax updated successfully', tax });
  } catch (error) {
    console.error('Error updating tax:', error.message);
    res.status(500).json({ message: 'Error updating tax', error });
  }
};

// Delete a tax record by ID
const deleteTaxById = async (req, res) => {
  try {
    const { id } = req.params;

    const tax = await Tax.findByPk(id);
    if (!tax) {
      return res.status(404).json({ message: 'Tax record not found' });
    }

    await tax.destroy();
    res.status(200).json({ message: 'Tax deleted successfully' });
  } catch (error) {
    console.error('Error deleting tax:', error.message);
    res.status(500).json({ message: 'Error deleting tax', error });
  }
};

// Create a new feature
const createFeature = async (req, res) => {
  try {
    const { featureName } = req.body;

    const existingFeature = await Feature.findOne({ where: { featureName } });
    if (existingFeature) {
      return res.status(400).json({ message: 'Feature already exists' });
    }

    const newFeature = await Feature.create({ featureName });
    res.status(201).json({ message: 'Feature created successfully', newFeature });
  } catch (error) {
    console.error('Error creating feature:', error.message);
    res.status(500).json({ message: 'Error creating feature', error });
  }
};

// Get all features
const getAllFeatures = async (req, res) => {
  try {
    const features = await Feature.findAll();
    if (features.length === 0) {
      return res.status(404).json({ message: 'No features found' });
    }
    res.status(200).json({ message: 'Features retrieved successfully', features });
  } catch (error) {
    console.error('Error fetching features:', error.message);
    res.status(500).json({ message: 'Error fetching features', error });
  }
};

// Delete a feature by ID
const deleteFeatureById = async (req, res) => {
  try {
    const { id } = req.params;

    const feature = await Feature.findByPk(id);
    if (!feature) {
      return res.status(404).json({ message: 'Feature not found' });
    }

    await feature.destroy();
    res.status(200).json({ message: 'Feature deleted successfully' });
  } catch (error) {
    console.error('Error deleting feature:', error.message);
    res.status(500).json({ message: 'Error deleting feature', error });
  }
};

module.exports = {
  createTax,
  getAllTaxes,
  updateTaxById,
  deleteTaxById,
  createFeature,
  getAllFeatures,
  deleteFeatureById,
};
