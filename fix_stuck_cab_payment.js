/**
 * Fix Stuck Cab Payment - Checks Cashfree for the payment status of stuck bookings
 * and manually updates the database if the payment was actually completed.
 * 
 * Usage: node fix_stuck_cab_payment.js
 */
const axios = require('axios');
require('dotenv').config();
const { CabBookingRequest, Transaction } = require('./Models');

// The stuck booking from our audit
const STUCK_BOOKING_ID = 'd06fafba-6fb2-4bed-b130-d19d533d9ef4';
const STUCK_LINK_ID = 'cab_fee_d06fafba_70df'; // From our audit

async function checkAndFix() {
  try {
    console.log('=== CHECKING STUCK CAB PAYMENT ===');
    console.log(`Booking ID: ${STUCK_BOOKING_ID}`);
    console.log(`Link ID:    ${STUCK_LINK_ID}`);
    
    const booking = await CabBookingRequest.findOne({ where: { bookingId: STUCK_BOOKING_ID } });
    if (!booking) {
      console.log('❌ Booking not found in database!');
      process.exit(1);
    }
    
    console.log(`\nCurrent DB state:`);
    console.log(`  status:        ${booking.status}`);
    console.log(`  paymentStatus: ${booking.paymentStatus}`);
    console.log(`  confirmationFee: ₹${booking.confirmationFee}`);

    // Query Cashfree API for the link status
    console.log(`\nQuerying Cashfree for link status of: ${STUCK_LINK_ID}`);
    try {
      const options = {
        method: 'GET',
        url: `https://api.cashfree.com/pg/links/${STUCK_LINK_ID}`,
        headers: {
          accept: 'application/json',
          'x-api-version': process.env.CASHFREE_API_VERSION || '2023-08-01',
          'x-client-id': process.env.CASHFREE_APP_ID,
          'x-client-secret': process.env.CASHFREE_SECRET_KEY,
        },
      };
      
      const response = await axios.request(options);
      const linkData = response.data;
      
      console.log(`\nCashfree Link Status: ${linkData.link_status}`);
      console.log(`Link Amount: ₹${linkData.link_amount}`);
      
      if (linkData.link_status === 'PAID' || linkData.link_status === 'PARTIALLY_PAID') {
        console.log('\n✅ Payment WAS completed! Fixing database...');
        
        // Update the booking
        await CabBookingRequest.update(
          { paymentStatus: 'paid' },
          { where: { bookingId: STUCK_BOOKING_ID } }
        );
        
        // Update the transaction record
        await Transaction.update(
          { status: 2 },
          { where: { Transactionid: STUCK_LINK_ID } }
        );
        
        console.log('✅ Database updated:');
        console.log(`   CabBookingRequest.paymentStatus = 'paid'`);
        console.log(`   Transaction.status = 2`);
        console.log('\n📱 The user should now see the End OTP after refreshing the app!');
      } else {
        console.log(`\n⚠️  Cashfree says payment is: ${linkData.link_status}`);
        console.log('The user may not have completed the payment, or it failed.');
        console.log('\nTo manually force-mark as paid (for testing), run:');
        console.log(`  node -e "require('./Models').CabBookingRequest.update({paymentStatus:'paid'},{where:{bookingId:'${STUCK_BOOKING_ID}'}}).then(()=>console.log('done')).then(()=>process.exit(0))"`);
      }
    } catch (apiErr) {
      console.error('❌ Cashfree API error:', apiErr.response?.data || apiErr.message);
      console.log('\nIf the payment was done, you can manually fix by running:');
      console.log(`  node fix_stuck_cab_payment.js --force`);
    }
    
    // If --force flag is passed, skip Cashfree and just update DB
    if (process.argv.includes('--force')) {
      console.log('\n⚡ --force flag detected. Manually marking booking as paid...');
      await CabBookingRequest.update(
        { paymentStatus: 'paid' },
        { where: { bookingId: STUCK_BOOKING_ID } }
      );
      await Transaction.update(
        { status: 2 },
        { where: { Transactionid: STUCK_LINK_ID } }
      );
      console.log('✅ Done! Booking marked as paid.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Script error:', err);
    process.exit(1);
  }
}

checkAndFix();
