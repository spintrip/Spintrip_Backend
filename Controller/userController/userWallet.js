const { Wallet, WalletTransaction, sequelize, Device, User, Driver, DriverWithdrawal } = require('../../Models');
const uuid = require('uuid');
const { sendPushNotification } = require('../../Utils/notifications');
const axios = require('axios');
const crypto = require('crypto');

/**
 * Get Wallet Details for User
 */
const getWalletDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    let wallet = await Wallet.findOne({
      where: { userId },
      include: [{
        model: WalletTransaction,
        limit: 50,
        order: [['createdAt', 'DESC']]
      }]
    });

    if (!wallet) {
      // Create a default wallet if none exists
      wallet = await Wallet.create({ id: uuid.v4(), userId, balance: 0 });
    }

    res.status(200).json({
      message: 'Wallet retrieved successfully',
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
      },
      transactions: wallet.WalletTransactions || [],
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ message: 'Error fetching wallet', error: error.message });
  }
};

/**
 * Initiate Wallet Recharge via Cashfree
 */
const initiateRecharge = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid recharge amount.' });
    }

    // Ensure the wallet exists
    let wallet = await Wallet.findOne({ where: { userId: user.id } });
    if (!wallet) {
      wallet = await Wallet.create({ id: uuid.v4(), userId: user.id, balance: 0 });
    }

    const orderId = `wallet_${uuid.v4()}`;

    // Temporarily record a pending transaction
    await WalletTransaction.create({
      id: uuid.v4(),
      walletId: wallet.id,
      amount: parseFloat(amount),
      type: 'CREDIT',
      description: 'Pending Wallet Recharge via Cashfree',
      referenceId: orderId,
    });

    // Sanitize name for Cashfree regex: must be alphabets/spaces only, min 3 chars
    let rawName = user.FullName || '';
    let cleanName = rawName.replace(/[^a-zA-Z\s]/g, '').trim();
    if (!cleanName || cleanName.length < 3) {
      cleanName = 'Spintrip Customer';
    }

    // Build Cashfree body
    const createOrderRequest = {
      link_id: orderId,
      link_amount: String(amount),
      link_currency: 'INR',
      link_purpose: 'Spintrip Wallet Recharge',
      customer_details: {
        customer_name: cleanName,
        customer_phone: user.phone,
        customer_email: user.email || 'customer@spintrip.in',
      },
      link_meta: {
        notify_url: `https://spintrip.in/api/api/users/wallet/webhook/cashfree`,
      },
      link_notify: {
        send_sms: false,
        send_email: false
      },
      link_notes: {
        userId: String(user.id),
      }
    };

    const options = {
      method: 'POST',
      url: 'https://api.cashfree.com/pg/links',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-version': process.env.CASHFREE_API_VERSION || '2023-08-01',
        'x-client-id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY,
      },
      data: JSON.stringify(createOrderRequest),
    };

    const response = await axios.request(options);
    console.log('Cashfree Wallet Recharge Link created:', response.data);

    if (response.data && response.status === 200) {
      // Return order to client
      return res.status(200).json({
        message: 'Wallet recharge link generated.',
        raw: response.data,
      });
    } else {
      return res.status(400).json({ message: 'Failed to create payment link', error: response.data });
    }
  } catch (error) {
    console.error('Error initiating wallet recharge:', error.response?.data || error.message);
    res.status(500).json({ message: 'Error initiating recharge', error: error.message });
  }
};

/**
 * Handle Cashfree Webhooks for Wallet Recharges
 */
const walletWebhook = async (req, res) => {
  try {
    const { type, data } = req.body;
    console.log('Wallet Recharge Webhook received:', type);

    if (type === 'PAYMENT_LINK_EVENT') {
      const { link_id, link_status, link_amount, link_notes } = data;

      // Ensure the correct transaction lookup context if necessary, 
      // but primarily we'll find the Pending Wallet transaction
      const transaction = await WalletTransaction.findOne({ where: { referenceId: link_id, type: 'CREDIT' } });

      if (!transaction) {
        console.error(`WalletTransaction for ${link_id} not found.`);
        return res.status(404).send('Transaction not found');
      }

      // Check if it's already successfully processed
      if (transaction.description === 'Wallet Recharge Completed') {
         return res.status(200).send('Webhook already processed for this link_id');
      }

      if (link_status === 'PARTIALLY_PAID' || link_status === 'PAID') {
        const t = await sequelize.transaction();
        try {
          const wallet = await Wallet.findOne({ where: { id: transaction.walletId }, transaction: t });
          
          if (wallet) {
             wallet.balance = parseFloat(wallet.balance) + parseFloat(link_amount);
             await wallet.save({ transaction: t });

             transaction.description = 'Wallet Recharge Completed';
             transaction.amount = parseFloat(link_amount);
             await transaction.save({ transaction: t });

             await t.commit();
             console.log(`Wallet officially credited by Rs. ${link_amount} for Wallet ID: ${wallet.id}`);

             // Push Notification (Isolated to prevent transaction rollback overlap)
             try {
                 const userObj = await User.findByPk(wallet.userId);
                 if (userObj && userObj.fcmToken) {
                    await sendPushNotification(
                       userObj.fcmToken,
                       "Wallet Recharged Successfully",
                       `Your Spintrip Wallet has been credited with Rs. ${link_amount}. Current Balance: Rs. ${wallet.balance}.`
                    );
                 }
             } catch (pushErr) {
                 console.error("Non-critical Push Notification Error after Wallet Recharge:", pushErr.message);
             }
          } else {
             await t.rollback();
          }
        } catch (innerErr) {
          await t.rollback();
          throw innerErr;
        }
      } else if (link_status === 'FAILED' || link_status === 'EXPIRED') {
        transaction.description = `Wallet Recharge ${link_status}`;
        await transaction.save();
      }
    }

    res.status(200).send('Wallet Webhook processed successfully');
  } catch (error) {
    console.error('Error processing Wallet Webhook:', error.message);
    res.status(500).send({ message: error.message });
  }
};

const walletWithdraw = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid withdrawal amount.' });
    }

    // 1. Fetch Driver row (Withdrawals only available for Drivers structurally)
    const driver = await Driver.findOne({ where: { id: userId }, transaction: t });
    if (!driver) {
      await t.rollback();
      return res.status(403).json({ message: 'Only registered drivers can withdraw funds.' });
    }

    // 2. Extract Bank details dynamically
    if (!driver.upiId && !driver.bankAccountNumber) {
       await t.rollback();
       return res.status(400).json({ message: 'Please update your Wallet Payouts (Bank/UPI) details in your Profile before withdrawing.' });
    }

    // 3. Lock Wallet and Check Balance safely protecting Overdrafts
    const wallet = await Wallet.findOne({ where: { userId }, transaction: t, lock: t.LOCK.UPDATE });
    if (!wallet) {
      await t.rollback();
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    if (parseFloat(wallet.balance) < parseFloat(amount)) {
      await t.rollback();
      return res.status(400).json({ message: 'Insufficient Spintrip Cash balance.' });
    }

    // 4. PRE-DEDUCT: Immediately slice the requested slice to completely block double-spends!
    wallet.balance = parseFloat(wallet.balance) - parseFloat(amount);
    await wallet.save({ transaction: t });

    // 5. Build Wallet Ledger Transaction Mapping visibly for Driver
    await WalletTransaction.create({
      id: uuid.v4(),
      walletId: wallet.id,
      amount: parseFloat(amount),
      type: 'DEBIT',
      description: 'Pending Driver Withdrawal Request',
      referenceId: `wd_${uuid.v4()}`,
    }, { transaction: t });

    // 6. Push the distinct request strictly to native Admin Review Pipeline
    let bankDetailsSnapshot = {
      upiId: driver.upiId || 'Not Provided',
      bankAccountNumber: driver.bankAccountNumber || 'Not Provided'
    };

    await DriverWithdrawal.create({
      id: uuid.v4(),
      driverId: driver.id,
      amount: parseFloat(amount),
      status: 'pending',
      bankDetails: bankDetailsSnapshot,
      requestDate: new Date()
    }, { transaction: t });

    await t.commit();
    return res.status(200).json({ message: 'Withdrawal successfully requested. Admin will review within 24 hours.' });

  } catch (error) {
    await t.rollback();
    console.error('Error requesting withdrawal:', error.message);
    res.status(500).json({ message: 'Error requesting withdrawal', error: error.message });
  }
};

module.exports = {
  getWalletDetails,
  initiateRecharge,
  walletWebhook,
  walletWithdraw
};
