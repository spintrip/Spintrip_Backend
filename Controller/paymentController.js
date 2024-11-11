const axios = require('axios');
const { Vehicle, Transaction, User, HostPayment } = require('../Models');
require('dotenv').config();
const crypto = require('crypto');
const uuid = require('uuid');
function roundToTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
const initiatePayment = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const { vehicleid } = req.body;
    const vehicle = await Vehicle.findOne({ where: { vehicleid : vehicleid  } });
  
    if (!vehicle) {
      return res.status(404).json({ message: 'vehicle not found' });
    }
    const hostPaymentPlan = await  HostPayment.findOne({ where: { VehicleId : vehicleid  } });
    let amount = roundToTwo(hostPaymentPlan.Amount);
    const orderId = uuid.v4();

    const paymentLinkRequest = {
      customer_details: {
        customer_phone: user.phone,
        customer_email: '',
        customer_name: '',
      },
      link_notify: {
        send_sms: false,
        send_email: false,
      },
      link_amount: amount,
      link_id: orderId,
      link_currency: 'INR',
      link_purpose: 'Plan Activation Payment',
      notes: {
        order_note: 'Payment for Vehicle Activation',
      },
      callback_url: `https://spintripbackend.site/api/users/webhook/cashfree`,
      expires_at: '2024-09-29T00:00:00Z',
      payment_methods: 'all', 
    };
  
    const options = {
      method: 'POST',
      url: 'https://api.cashfree.com/pg/links',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-version': '2022-09-01',
        'x-client-id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY,
      },
      data: JSON.stringify(paymentLinkRequest),
    };
    
    const response = await axios.request(options);
    console.log(response);
    if (response.data.link_status === 'ACTIVE') {
      console.log('Cashfree Response:', response); 
  
      const paymentUrl = response.data.link_url;
  
      // Save transaction details to your database
      await Transaction.create({
        Transactionid: orderId,
        vehicleid: vehicleid,
        id: req.user.id,
        status: 1,
        amount: hostPaymentPlan.Amount,
        GSTAmount: hostPaymentPlan.GSTAmount,
        totalAmount:hostPaymentPlan.TotalAmount,
      });
      await hostPaymentPlan.update({ Transactionid: orderId });
      return res.status(200).json({ paymentUrl });
    } else {
      console.error('Error creating payment link:', response.data);
      return res.status(400).json({ message: 'Failed to create payment link', error: response.data.message });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }  
};




const phonePayment = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const { vehicleid } = req.body;
    const vehicle = await Vehicle.findOne({ where: { vehicleid: vehicleid } });
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    const hostPaymentPlan = await HostPayment.findOne({ where: { VehicleId: vehicleid } });
    if (!hostPaymentPlan) {
      return res.status(404).json({ message: 'Host Plan not found' });
    }
    let amount;
    const orderId = uuid.v4();
    await Transaction.create({
      Transactionid: orderId,
      vehicleid: vehicleid,
      id: req.user.id,
      status: 1,
      amount: hostPaymentPlan.Amount,
      GSTAmount: hostPaymentPlan.GSTAmount,
      totalAmount: hostPaymentPlan.TotalAmount
    });
    await hostPaymentPlan.update({ Transactionid: orderId });
    const payload = {
        "merchantId": "M2207FVORVMF0",
        "merchantTransactionId": orderId,
        "merchantUserId": "M2207FVORVMF0",
        "amount": amount * 100,
        "redirectUrl": "https://spintrip.in/user/user-dashboard",
        "redirectMode": "REDIRECT",
        "callbackUrl": "https://spintripbackend.site/api/users/webhook/phonepe",
        "mobileNumber": user.phone,
        "paymentInstrument": {
            "type": "PAY_PAGE"
        }
    };

    const saltKey = process.env.SALT_KEY; // Replace with your actual salt key
    const saltIndex = 1; // Replace with the actual salt index

    // Encode the payload to base64
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');

    // Generate the string to hash for the request
    const stringToHash = payloadBase64 + '/pg/v1/pay' + saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');

    // X-VERIFY header
    const xVerify = `${sha256}###${saltIndex}`;

    const options = {
        method: 'POST',
        url: 'https://api.phonepe.com/apis/hermes/pg/v1/pay',
        headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': xVerify
        },
        data: { "request": payloadBase64 }
     };
    
     
    axios
        .request(options)
        .then(function (response) {
            console.log('Response received:', response.data);
            if (response.data.success == true){
            return res.status(200).json({ "paymentUrl": response.data.data.instrumentResponse.redirectInfo.url});
            }
            else{
              return res.status(400).json( { message: 'Failed to create payment link', error: response.data.message });
            }
        })
        .catch(function (error) {
          return res.status(400).json( { message: 'Failed to create payment link' });
        });
} catch (error) {
  return res.status(500).json( { message: 'Server Error' });
}
};

const checkPaymentStatus = async (req, res) => {
  try {
    const { type, data } = req.body; 

    console.log('Webhook verified and payload received:');

    switch (type) {
      case 'PAYMENT_LINK_EVENT':
        const { link_id, link_status, transaction_id, order } = data;

        let transaction = await Transaction.findOne({ where: { Transactionid: link_id } });

        if (!transaction) {
          console.error(`Transaction with ID ${ link_id } not found`);
          return res.status(404).send('Transaction not found');
        }

        if (link_status === 'PARTIALLY_PAID' || link_status === 'PAID') {
          await transaction.update({ status: 2 }); 
        } else if (link_status === 'FAILED' || link_status === 'EXPIRED') {
          await transaction.update({ status: 3 }); 
        }

        console.log(`Payment status updated for link ID: ${link_id} with status: ${link_status}`);

        // Fetch booking and user details if needed and send a confirmation email
        const hostPayment = await HostPayment.findOne({ where: { VehicleId: transaction.vehicleid } });
        const user = await User.findByPk(booking.id);

        const PlanDetails = {
          VehicleId: hostPayment.vehicleid,
          PlanType: hostPayment.PlanType,
          PlanEndDate: hostPayment.PlanEndDate,
          amount: hostPayment.TotalAmount
        };

        // Send confirmation email
        await sendBookingConfirmationEmail(user.email, bookingDetails);
        break;

      case 'TRANSFER_REJECTED':
        const { rejectId, reason } = data;
        await Transaction.update({ status: 3, reason }, { where: { Transactionid: rejectId } });
        console.log(`Transfer rejected for ID: ${rejectId}, Reason: ${reason}`);
        break;

      case 'AMOUNT_SETTLED':
        const { settlementId, settlementAmount } = data;
        // Handle settlement logic
        console.log(`Settlement completed for ID: ${settlementId} with amount: ${settlementAmount}`);
        break;

      case 'REFUND_SUCCESS':
        // Handle refund success logic
        console.log(`Refund successful for event: ${type}`);
        break;

      case 'REFUND_FAILED':
        // Handle refund failure logic
        console.log(`Refund failed for event: ${type}`);
        break;

      case 'REFUND_REVERSED':
        // Handle refund reversed logic
        console.log(`Refund reversed for event: ${type}`);
        break;

      default:
        console.log(`Unhandled event type: ${type}`);
    }

    res.status(200).send('Webhook processed successfully');
  } catch (error) {
    console.error('Error processing Cashfree webhook:', error);
    res.status(500).send({ message: error.message });
  }
};

const webhook = async (req, res) => {
  try {
    const base64Response = req.body.response;

    const decodedResponse = Buffer.from(base64Response, 'base64').toString('utf-8');

    const jsonResponse = JSON.parse(decodedResponse);

    const xVerify = req.headers['x-verify'];
    const saltKey = process.env.SALT_KEY; 
    const saltIndex = 1;  

    const computedChecksum = crypto.createHash('sha256').update(base64Response + saltKey).digest('hex') + '###' + saltIndex;

    if (xVerify !== computedChecksum) {
        return res.status(400).send('Invalid checksum');
    }

    const { success, code, message, data } = jsonResponse;
    const transaction = await Transaction.findOne({ where: { Transactionid: data.merchantTransactionId } });

    if (!transaction) {
        console.error(`Transaction with ID ${data.transactionId} not found`);
        return res.status(404).send('Transaction not found');
    }

    if (success && code === 'PAYMENT_SUCCESS') {
        await transaction.update({ status: 2 });
        console.log(`Payment successful for transaction ${data.merchantTransactionId}`);

        // Fetch user and booking details
        const booking = await Booking.findOne({ where: { Bookingid: transaction.Bookingid } });
        const user = await User.findByPk(booking.id);

        // Prepare email content
        const bookingDetails = {
          carModel: booking.carmodel,
          startDate: booking.startTripDate,
          endDate: booking.endTripDate,
          amount: booking.totalUserAmount
        };

        // Send email to the user
        await sendBookingConfirmationEmail(user.email, bookingDetails);

    } else {
        await transaction.update({ status: 3 });
        console.log(`Payment failed for transaction ${data.merchantTransactionId}`);
    }

    res.status(200).send('Webhook processed successfully');
  } catch (error) {
    console.error('Error processing payment status:', error);
    res.status(500).send({ message: error.message });
  }
};

module.exports = {
  initiatePayment,
  checkPaymentStatus,
  phonePayment,
  webhook
};
