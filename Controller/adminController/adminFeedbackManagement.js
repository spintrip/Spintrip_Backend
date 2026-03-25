const { Feedback } = require('../../Models');

// Get all feedbacks
const getAllFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json({ success: true, feedbacks });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Delete feedback by ID
const deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findByPk(req.params.id);
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }
    await feedback.destroy();
    res.status(200).json({ success: true, message: 'Feedback deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllFeedbacks,
  deleteFeedback
};
