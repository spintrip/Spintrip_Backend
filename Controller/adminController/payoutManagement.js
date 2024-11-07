const { Payout, Booking } = require('../../Models');

const createPayout = async (req, res) => {
  try {
    const { userId, bookingIds, date, time, modeOfPayment } = req.body;

    if (!userId || !bookingIds || !date || !time || !modeOfPayment) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const newPayout = await Payout.create({
      userId,
      bookingIds,
      date,
      time,
      modeOfPayment,
    });

    res.status(201).json({ message: 'Payout created successfully', payout: newPayout });
  } catch (error) {
    console.error('Error creating payout:', error.message);
    res.status(500).json({ message: 'Error creating payout', error });
  }
};

const getAllPayouts = async (req, res) => {
  try {
    const payouts = await Payout.findAll();
    if (payouts.length === 0) {
      return res.status(404).json({ message: 'No payouts found' });
    }

    const payoutsWithTotalAmount = await Promise.all(
      payouts.map(async (payout) => {
        const bookings = await Booking.findAll({
          where: { Bookingid: payout.bookingIds },
        });

        const totalAmount = bookings.reduce((sum, booking) => sum + (booking.totalHostAmount || 0), 0);

        return {
          ...payout.toJSON(),
          totalAmount,
        };
      })
    );

    res.status(200).json({ message: 'Payouts retrieved successfully', payouts: payoutsWithTotalAmount });
  } catch (error) {
    console.error('Error fetching payouts:', error.message);
    res.status(500).json({ message: 'Error fetching payouts', error });
  }
};

const getPayoutById = async (req, res) => {
  try {
    const { id } = req.params;
    const payout = await Payout.findByPk(id);

    if (!payout) {
      return res.status(404).json({ message: 'Payout not found' });
    }

    res.status(200).json({ message: 'Payout retrieved successfully', payout });
  } catch (error) {
    console.error('Error fetching payout:', error.message);
    res.status(500).json({ message: 'Error fetching payout', error });
  }
};

const updatePayoutById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, bookingIds, date, time, modeOfPayment } = req.body;

    const payout = await Payout.findByPk(id);

    if (!payout) {
      return res.status(404).json({ message: 'Payout not found' });
    }

    payout.userId = userId || payout.userId;
    payout.bookingIds = bookingIds || payout.bookingIds;
    payout.date = date || payout.date;
    payout.time = time || payout.time;
    payout.modeOfPayment = modeOfPayment || payout.modeOfPayment;

    await payout.save();

    res.status(200).json({ message: 'Payout updated successfully', payout });
  } catch (error) {
    console.error('Error updating payout:', error.message);
    res.status(500).json({ message: 'Error updating payout', error });
  }
};

const deletePayoutById = async (req, res) => {
  try {
    const { id } = req.params;

    const payout = await Payout.findByPk(id);

    if (!payout) {
      return res.status(404).json({ message: 'Payout not found' });
    }

    await payout.destroy();

    res.status(200).json({ message: 'Payout deleted successfully' });
  } catch (error) {
    console.error('Error deleting payout:', error.message);
    res.status(500).json({ message: 'Error deleting payout', error });
  }
};

module.exports = { createPayout, getAllPayouts, getPayoutById, updatePayoutById, deletePayoutById };
