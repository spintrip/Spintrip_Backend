const { SupportTicket, Chat, User } = require('../../Models');

// View all support tickets
const viewAllSupportTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.findAll({
      include: [{ model: User, attributes: ['id', 'FullName', 'Email'] }],
      order: [['createdAt', 'DESC']],
    });
    if (tickets.length === 0) {
      return res.status(404).json({ message: 'No support tickets found' });
    }
    res.status(200).json({ message: 'Support tickets retrieved successfully', tickets });
  } catch (error) {
    console.error('Error fetching support tickets:', error.message);
    res.status(500).json({ message: 'Error fetching support tickets', error });
  }
};

// Reply to a support ticket
const replyToSupportTicket = async (req, res) => {
  try {
    const { ticketId, message, userId } = req.body;
    const ticket = await SupportTicket.findByPk(ticketId);

    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    const chatMessage = await Chat.create({
      ticketId,
      message,
      userId,
      role: 'support',
    });

    res.status(200).json({ message: 'Reply added successfully', chatMessage });
  } catch (error) {
    console.error('Error replying to support ticket:', error.message);
    res.status(500).json({ message: 'Error replying to support ticket', error });
  }
};

// Escalate a support ticket
const escalateSupportTicket = async (req, res) => {
  try {
    const { ticketId, escalationReason } = req.body;
    const ticket = await SupportTicket.findByPk(ticketId);

    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    ticket.status = 'escalated';
    ticket.escalationReason = escalationReason;
    await ticket.save();

    res.status(200).json({ message: 'Support ticket escalated successfully', ticket });
  } catch (error) {
    console.error('Error escalating support ticket:', error.message);
    res.status(500).json({ message: 'Error escalating support ticket', error });
  }
};

// Resolve a support ticket
const resolveSupportTicket = async (req, res) => {
  try {
    const { ticketId, resolutionMessage } = req.body;
    const ticket = await SupportTicket.findByPk(ticketId);

    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    ticket.status = 'resolved';
    ticket.resolutionMessage = resolutionMessage;
    await ticket.save();

    res.status(200).json({ message: 'Support ticket resolved successfully', ticket });
  } catch (error) {
    console.error('Error resolving support ticket:', error.message);
    res.status(500).json({ message: 'Error resolving support ticket', error });
  }
};

// View all chats for a specific ticket
const viewAllChats = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await SupportTicket.findByPk(ticketId);

    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    const chats = await Chat.findAll({
      where: { ticketId },
      order: [['createdAt', 'ASC']],
      include: [{ model: User, attributes: ['FullName', 'Email'] }],
    });

    res.status(200).json({ message: 'Chats retrieved successfully', chats });
  } catch (error) {
    console.error('Error fetching chats:', error.message);
    res.status(500).json({ message: 'Error fetching chats', error });
  }
};

module.exports = {
  viewAllSupportTickets,
  replyToSupportTicket,
  escalateSupportTicket,
  resolveSupportTicket,
  viewAllChats,
};
