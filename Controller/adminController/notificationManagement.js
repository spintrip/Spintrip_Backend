const { UserAdditional } = require('../../Models');
const { sendEmail } = require('../emailController');

const sendNotification = async (req, res) => {
  try {
    const { userIds, subject, message } = req.body;

    if (!userIds || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs are required' });
    }

    const users = await UserAdditional.findAll({
      where: {
        id: userIds,
      },
    });

    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found for provided IDs' });
    }

    // Send notifications to each user
    const notificationResults = await Promise.all(users.map(async (user) => {
      const email = user.Email;
      if (email) {
        await sendEmail(email, subject, message);
        return { userId: user.id, status: 'Notification sent' };
      }
      return { userId: user.id, status: 'No email found' };
    }));

    res.status(200).json({
      message: 'Notifications processed',
      results: notificationResults,
    });
  } catch (error) {
    console.error('Error sending notifications:', error.message);
    res.status(500).json({ message: 'Error sending notifications', error });
  }
};

module.exports = { sendNotification };
