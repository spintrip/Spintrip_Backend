
const { User, Vehicle, Chat, UserAdditional, Listing, sequelize, Booking, Pricing,
  carFeature, Feedback, Host, Tax, Wishlist, Feature, Blog, Bike, Car, HostAdditional, VehicleAdditional, BookingExtension, Transaction } = require('../../Models');
const express = require('express');





const chat = async (req, res) => {
  const { hostId, message } = req.body;
  const userId = req.user.id;
  let imagePath = null;

  if (req.file) {
    imagePath = `http://localhost:5000/uploads/${userId}/${req.file.filename}`;
  }

  try {
    const chat = await Chat.create({
      userId,
      hostId,
      message,
      imagePath,
    });

    res.status(201).json({ message: 'Chat message sent', chat });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error sending chat message' });
  }
}
const chathistory = async (req, res) => {
  const { hostId } = req.query;
  const userId = req.user.id;

  try {
    const chats = await Chat.findAll({
      where: { userId, hostId },
      order: [['timestamp', 'ASC']],
    });

    res.status(200).json({ chats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching chat history' });
  }
}


module.exports = { chat, chathistory };