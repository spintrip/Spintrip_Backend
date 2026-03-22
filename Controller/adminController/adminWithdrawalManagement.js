const { DriverWithdrawal, Driver, User, Wallet, WalletTransaction, sequelize } = require('../../Models');
const uuid = require('uuid');

const getAllWithdrawals = async (req, res) => {
  try {
    const withdrawals = await DriverWithdrawal.findAll({
      include: [
        {
          model: Driver,
          attributes: ['id', 'upiId', 'bankAccountNumber'],
          include: [
            {
              model: User,
              attributes: ['FullName', 'phone', 'email']
            }
          ]
        }
      ],
      order: [['requestDate', 'DESC']]
    });

    res.status(200).json({
      message: 'Withdrawals fetched successfully',
      count: withdrawals.length,
      withdrawals: withdrawals
    });
  } catch (error) {
    console.error('Error fetching driver withdrawals:', error);
    res.status(500).json({ message: 'Error fetching driver withdrawals', error: error.message });
  }
};

const approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const withdrawal = await DriverWithdrawal.findByPk(id);

    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found.' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ message: `Withdrawal is already ${withdrawal.status}.` });
    }

    // Money is already officially locked out of Wallet. 
    // Admin approving just effectively confirms the real bank transfer.
    withdrawal.status = 'approved';
    await withdrawal.save();

    res.status(200).json({ message: 'Withdrawal successfully approved.' });
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    res.status(500).json({ message: 'Error approving withdrawal', error: error.message });
  }
};

const rejectWithdrawal = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const withdrawal = await DriverWithdrawal.findByPk(id, { transaction: t });

    if (!withdrawal) {
      await t.rollback();
      return res.status(404).json({ message: 'Withdrawal not found.' });
    }

    if (withdrawal.status !== 'pending') {
      await t.rollback();
      return res.status(400).json({ message: `Withdrawal is already ${withdrawal.status}.` });
    }

    // 1. Mark as rejected
    withdrawal.status = 'rejected';
    await withdrawal.save({ transaction: t });

    // 2. Safely refund the Locked Amount back into the Driver's Wallet mathematically
    const wallet = await Wallet.findOne({ where: { userId: withdrawal.driverId }, transaction: t, lock: t.LOCK.UPDATE });
    
    if (wallet) {
      wallet.balance = parseFloat(wallet.balance) + parseFloat(withdrawal.amount);
      await wallet.save({ transaction: t });

      // Build Ledger trace for the refund visually
      await WalletTransaction.create({
        id: uuid.v4(),
        walletId: wallet.id,
        amount: parseFloat(withdrawal.amount),
        type: 'CREDIT',
        description: 'Refund: Withdrawal Request Rejected',
        referenceId: `rf_${uuid.v4()}`,
      }, { transaction: t });
    }

    await t.commit();
    res.status(200).json({ message: 'Withdrawal rejected. Funds successfully refunded to Driver Wallet.' });
  } catch (error) {
    await t.rollback();
    console.error('Error rejecting withdrawal:', error);
    res.status(500).json({ message: 'Error rejecting withdrawal', error: error.message });
  }
};

module.exports = {
  getAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal
};
