const cron = require('node-cron');
const { Booking, CabBookingRequest, Wallet, WalletTransaction, sequelize, ReferralReward } = require('../Models');
const uuid = require('uuid');
const { Op } = require('sequelize');
const moment = require('moment');

/**
 * Initialize all Cron Jobs
 */
const initCronJobs = () => {
  // Run every 5 minutes to sweep ghost bookings
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Running Ghost Bookings Sweeper...');
    try {
      const fifteenMinutesAgo = moment().subtract(15, 'minutes').toDate();

      // Find all pending bookings older than 15 minutes
      const expiredBookings = await Booking.findAll({
        where: {
          status: 1, // 1 = Pending Payment/Confirmation
          createdAt: {
            [Op.lt]: fifteenMinutesAgo
          }
        }
      });

      if (expiredBookings.length > 0) {
        console.log(`[Cron] Found ${expiredBookings.length} ghost bookings to expire.`);
        
        // Update all simultaneously
        await Booking.update(
          { 
            status: 4, // 4 = Cancelled/Expired
            cancelReason: "System Auto-Cancelled due to payment/handover timeout"
          }, 
          {
            where: {
              Bookingid: {
                [Op.in]: expiredBookings.map(b => b.Bookingid)
              }
            }
          }
        );

        console.log('[Cron] Ghost bookings successfully cleared.');
      } else {
        console.log('[Cron] No ghost bookings found.');
      }
    } catch (error) {
      console.error('[Cron] Error running ghost bookings sweeper:', error.message);
    }
  });

  // Cab Ghost Bookings Sweeper (Refund Wallet)
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Running Cab Ghost Bookings Sweeper...');
    try {
      const fifteenMinutesAgo = moment().subtract(15, 'minutes').toDate();

      // Find all pending soft bookings (status 5) older than 15 minutes
      const expiredCabRequests = await CabBookingRequest.findAll({
        where: {
          status: 5,
          createdAt: {
            [Op.lt]: fifteenMinutesAgo
          }
        }
      });

      if (expiredCabRequests.length > 0) {
        console.log(`[Cron] Found ${expiredCabRequests.length} unfulfilled cab requests to expire and refund.`);

        for (const req of expiredCabRequests) {
          const t = await sequelize.transaction();
          try {
            // Find the 20% deduction transaction linked to this bookingId
            const debitTxn = await WalletTransaction.findOne({
              where: { referenceId: req.bookingId, type: 'DEBIT' },
              transaction: t
            });

            if (debitTxn) {
              const wallet = await Wallet.findOne({
                where: { id: debitTxn.walletId },
                transaction: t
              });

              if (wallet) {
                // Refund the amount
                const refundAmount = parseFloat(debitTxn.amount);
                wallet.balance = parseFloat(wallet.balance) + refundAmount;
                await wallet.save({ transaction: t });

                // Log credit transaction
                await WalletTransaction.create({
                  id: uuid.v4(),
                  walletId: wallet.id,
                  amount: refundAmount,
                  type: 'CREDIT',
                  description: 'Refund for unfulfilled Cab search timeout',
                  referenceId: req.bookingId,
                }, { transaction: t });
              }
            }

            // Update the cab request completely
            await req.update({ status: 4 }, { transaction: t });

            await t.commit();
          } catch (innerErr) {
            await t.rollback();
            console.error(`[Cron] Error refunding cab request ${req.bookingId}:`, innerErr);
          }
        }
        console.log('[Cron] Cab ghost requests successfully refunded and cleared.');
      } else {
        console.log('[Cron] No ghost cab requests found.');
      }
    } catch (error) {
      console.error('[Cron] Error running cab ghost bookings sweeper:', error.message);
    }
  });

  // Referral Reward Expiry Sweeper (Runs daily at midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Running Referral Reward Expiry Sweeper...');
    try {
      const [expiredCount] = await ReferralReward.update(
        { status: 'expired' },
        {
          where: {
            status: 'earned',
            expiryDate: { [Op.lt]: new Date() }
          }
        }
      );
      if (expiredCount > 0) {
        console.log(`[Cron] Expired ${expiredCount} referral rewards.`);
      }
    } catch (error) {
      console.error('[Cron] Error running referral reward expiry sweeper:', error.message);
    }
  });

  console.log('[Cron] Initialized all jobs (Ghost Bookings & Referral Expiry)');
};

module.exports = {
  initCronJobs
};
