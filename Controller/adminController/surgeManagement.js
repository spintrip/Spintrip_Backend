const { SurgePrice } = require('../../Models');

const getSurgeRules = async (req, res) => {
    try {
        const rules = await SurgePrice.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json({ success: true, data: rules });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching surge rules', error: error.message });
    }
};

const createSurgeRule = async (req, res) => {
    try {
        const rule = await SurgePrice.create(req.body);
        res.status(201).json({ success: true, message: 'Surge rule created successfully', data: rule });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating surge rule', error: error.message });
    }
};

const updateSurgeRule = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await SurgePrice.update(req.body, { where: { id } });
        if (!updated) return res.status(404).json({ success: false, message: 'Surge rule not found' });
        
        const updatedRule = await SurgePrice.findByPk(id);
        res.status(200).json({ success: true, message: 'Surge rule updated successfully', data: updatedRule });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating surge rule', error: error.message });
    }
};

const deleteSurgeRule = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await SurgePrice.destroy({ where: { id } });
        if (!deleted) return res.status(404).json({ success: false, message: 'Surge rule not found' });
        res.status(200).json({ success: true, message: 'Surge rule deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting surge rule', error: error.message });
    }
};

module.exports = {
    getSurgeRules,
    createSurgeRule,
    updateSurgeRule,
    deleteSurgeRule
};
