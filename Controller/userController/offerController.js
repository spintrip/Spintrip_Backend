const { Offer } = require('../../Models');
const { Op } = require('sequelize');

exports.validateOffer = async (req, res) => {
  try {
    const { code, amount } = req.body;

    if (!code || !amount) {
      return res.status(400).json({ success: false, message: "Promo code and amount are required" });
    }

    const offer = await Offer.findOne({
      where: {
        code: code,
        isActive: true,
        [Op.or]: [
          { expiryDate: null },
          { expiryDate: { [Op.gt]: new Date() } }
        ]
      }
    });

    if (!offer) {
      return res.status(404).json({ success: false, message: "Invalid or expired promo code" });
    }

    // Check usage limit
    if (offer.usageLimit !== -1 && offer.usedCount >= offer.usageLimit) {
      return res.status(400).json({ success: false, message: "Promo code usage limit exceeded" });
    }

    // Check minimum booking amount
    if (amount < offer.minAmount) {
      return res.status(400).json({ 
        success: false, 
        message: `This offer is only valid for bookings above ₹${offer.minAmount}` 
      });
    }

    // Calculate discount
    let discount = amount * (offer.percentage / 100);
    
    // Apply cap
    if (discount > offer.maxDiscount) {
      discount = offer.maxDiscount;
    }

    res.status(200).json({
      success: true,
      message: "Promo code applied successfully",
      data: {
        offerId: offer.id,
        code: offer.code,
        discountAmount: parseFloat(discount.toFixed(2)),
        finalAmount: parseFloat((amount - discount).toFixed(2))
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAvailableOffers = async (req, res) => {
  try {
    const offers = await Offer.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          { expiryDate: null },
          { expiryDate: { [Op.gt]: new Date() } }
        ]
      },
      attributes: ['code', 'percentage', 'maxDiscount', 'minAmount', 'description', 'expiryDate']
    });

    res.status(200).json({ success: true, offers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
