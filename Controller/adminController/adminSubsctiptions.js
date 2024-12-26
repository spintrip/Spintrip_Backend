const {Subscriptions, Admin} = require('../../Models');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid');

const subscriptions = async (req, res) => {
  try {
    const { planName, vehicleType, remarks, expiry, amount  } = req.body; // Assume the request body contains subscription details
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const planType = uuid.v4();
    const newSubscription = await Subscriptions.create({ PlanType: planType, vehicleType: vehicleType, PlanName: planName, expiry: expiry, amount: amount, remarks:remarks });

    res.status(201).json({
      message: 'Subscription added successfully',
      subscription: newSubscription,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: 'Error adding subscription',
      error: error.message,
    });
  }
};


  module.exports = {subscriptions};