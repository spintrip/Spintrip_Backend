const { 
  Support, SupportChat, Booking, Cab, VehicleAdditional, 
  Device, HostPayment, DriverWithdrawal, Vehicle 
} = require('../Models');
const uuid = require('uuid');
const { notifyUserById } = require('../Utils/notificationService');

// SPINTRIP POLICIES (Extracted from Frontend policy.dart)
const POLICIES = {
    refund: "Platform Discovery Fee: Non-refundable if cancelled within 1 HOUR of the trip start time. The remaining balance is paid directly to the Driver/Host. Spintrip is not responsible for this payment.",
    verification: "Spintrip: Comprehensive Legal Policies. Operational liability lies 100% with the Host. Document verification usually takes 15-30 minutes during business hours.",
    safety: "SAFE HARBOR: Spintrip is an IT Intermediary (Section 2(1)(w) IT Act, 2000). We are NOT liable for physical injuries or property damage. Liability lies 100% with the Driver/Host. Bangalore jurisdiction applies.",
    cancellation: "You can cancel your booking directly from the 'My Bookings' screen. Please note that if you cancel within 1 hour of the trip start time, the platform discovery fee is non-refundable.",
    payment_failure: "If your money was debited but the booking didn't successfully confirm, please don't worry! This is a common banking delay. The bank will automatically refund the deducted amount to your original payment method within 3-5 business days."
};

/**
 * DETERMINISTIC CONCIERGE ENGINE (ZERO COST)
 * Fetches real-time data based on message keywords and user role.
 */
const getSupportBotResponse = async (message, roleArg, userId) => {
    const msg = message.toLowerCase();
    const role = (roleArg || 'user').toLowerCase();
    
    console.log(`🤖 Bot processing for userId: ${userId}, role: ${role}`);

    try {
        // 🚨 CRITICAL/COMPLEX LOGIC
        // Respond empathetically to frustration, but DO NOT auto-escalate the ticket priority in the DB.
        if (msg.includes('urgent') || msg.includes('complain') || msg.includes('human') || msg.includes('escalate') || msg.includes('talk to someone')) {
            console.log("📋 Bot acknowledging urgent/human request without escalating db status.");
            return `I completely understand you need to speak with our senior team. I am notifying them right now, and a human agent will assist you shortly.`;
        }
        
        // ONLY escalate for safety / accidents / emergencies
        if (msg.includes('safety') || msg.includes('accident') || msg.includes('emergency') || msg.includes('crash')) {
             console.log("📋 Bot serving Safety Policy & Escalating");
             return `[ESCALATED] [SAFETY ALERT] Please ensure your physical safety first. If this is an emergency, contact local authorities immediately. Our priority incident team has been alerted and will reach out urgently.\n\nPolicy reference: ${POLICIES.safety}`;
        }

        // 🚖 PASSENGER LOGIC
        if (role === 'user' || role === 'passenger' || role === 'customer') {
            // Priority 1: Specific Policies (Static Knowledge)
            if (msg.includes('debited') || msg.includes('deducted') || msg.includes('failed') || (msg.includes('money') && msg.includes('happen'))) {
                console.log("📋 Bot serving Payment Failure Assurance");
                return `[PAYMENT SUPPORT] ${POLICIES.payment_failure}`;
            }
            if (msg.includes('cancel')) {
                console.log("📋 Bot serving Cancellation Policy");
                return `[CANCELLATION INFO] ${POLICIES.cancellation}`;
            }
            if (msg.includes('refund')) {
                console.log("📋 Bot serving Refund Policy");
                return `[REFUND SEARCH] I've checked our platform rules: ${POLICIES.refund}`;
            }
            if (msg.includes('verify') || msg.includes('verification') || msg.includes('approved')) {
                console.log("📋 Bot serving Verification Policy");
                return `[VERIFICATION SEARCH] I've checked our platform rules: ${POLICIES.verification}`;
            }

            // Priority 2: Real-time Data (Dynamic Lookups)
            if (msg.includes('where') || msg.includes('location') || msg.includes('car') || msg.includes('cab') || msg.includes('track')) {
                console.log("🔍 Bot checking active ride for location...");
                const lastBooking = await Booking.findOne({ 
                    where: { userId }, 
                    order: [['createdAt', 'DESC']]
                });
                
                if (!lastBooking) {
                    console.log("❌ No booking history found.");
                    return "I've checked your account history, but I couldn't find any active or recent bookings to track. Could you please provide a booking ID?";
                }
                
                // Detailed data check for user visibility
                console.log(`🔍 Checking booking ${lastBooking.id} with vehicle ${lastBooking.vehicleid}`);

                // Check if it's a Cab (Track via Driver)
                const cabMapping = await Cab.findOne({ where: { vehicleid: lastBooking.vehicleid } });
                if (cabMapping && cabMapping.driverId) {
                    const driverLoc = await VehicleAdditional.findOne({ where: { vehicleid: lastBooking.vehicleid } });
                    if (driverLoc && driverLoc.latitude) {
                        return `[LIVE TRACKING] I found your active Cab booking (${lastBooking.id}). Your driver is currently near [${driverLoc.latitude}, ${driverLoc.longitude}]. Updates were received recently.`;
                    }
                }
                
                // Check if it's Self-Drive (Track via Device)
                const deviceLoc = await Device.findOne({ where: { deviceid: lastBooking.vehicleid } });
                if (deviceLoc && deviceLoc.lat) {
                    return `[GPS TRACKING] I found your active Self-Drive booking (${lastBooking.id}). The car is currently located at [${deviceLoc.lat}, ${deviceLoc.lng}].`;
                }
                
                return `I found your booking (${lastBooking.id}), but the GPS signal is currently unavailable. Please try again in 5 minutes.`;
            }
            
            if (msg.includes('end') || msg.includes('time') || msg.includes('finish') || msg.includes('duration')) {
                const lastBooking = await Booking.findOne({ where: { userId }, order: [['createdAt', 'DESC']] });
                if (lastBooking && lastBooking.endTripTime) {
                    return `[TRIP STATUS] I've checked your schedule. Your current trip (${lastBooking.id}) is set to end on ${lastBooking.endTripDate} at ${lastBooking.endTripTime}.`;
                }
            }
        }

        // 🏠 HOST LOGIC
        if (role === 'host') {
            if (msg.includes('payout') || msg.includes('payment') || msg.includes('money') || msg.includes('earn')) {
                const lastPayment = await HostPayment.findOne({ 
                    where: { HostId: userId }, 
                    order: [['createdAt', 'DESC']] 
                });
                if (lastPayment) {
                    const statusStr = lastPayment.PaymentStatus === 1 ? 'Processed' : 'Pending';
                    return `[HOST PAYOUT] I found your most recent record. Your payout of ₹${lastPayment.TotalAmount} is currently ${statusStr}. (Reference Date: ${lastPayment.PaymentDate})`;
                }
                return "I've checked your host account, but I couldn't find any recent payout records. Payouts are usually generated after a trip is completed.";
            }
        }

        // 🛠️ DRIVER LOGIC
        if (role === 'driver') {
            if (msg.includes('withdrawal') || msg.includes('payment') || msg.includes('money') || msg.includes('earn')) {
                const lastWithdrawal = await DriverWithdrawal.findOne({ 
                    where: { driverId: userId }, 
                    order: [['createdAt', 'DESC']] 
                });
                if (lastWithdrawal) {
                    return `[DRIVER WITHDRAWAL] I found your request. Your withdrawal of ₹${lastWithdrawal.amount} is currently ${lastWithdrawal.status}.`;
                }
                return "I've checked your driver earnings, and you don't have any pending withdrawal requests at the moment.";
            }
        }
    } catch (dbError) {
        console.error("🤖 Bot Database Lookup Error:", dbError.stack);
    }

    // DEFAULT FALLBACK -> Friendly, No Escalation
    return "Hi! I'm the Spintrip Support Concierge. I'm reviewing your request now. A human agent has been assigned and will reply to you shortly! If you have any specific tracking or payment questions, feel free to ask me while you wait.";
};

const createSupportTicket = async (req, res) => {
  try {
    const { subject, message, category = 'general', bookingId, vehicleId, metadata } = req.body;
    const userId = req.user.id;
    const role = req.user.role || 'user';
    const ticketId = uuid.v4();
    const chatId = uuid.v4();

    const supportTicket = await Support.create({ 
      id: ticketId, 
      userId, 
      subject, 
      message,
      category,
      bookingId,
      vehicleId,
      metadata
    });
    
    // User's initial message
    await SupportChat.create({ 
      id: chatId, 
      supportId: ticketId, 
      userId: userId, 
      senderId: userId, 
      message,
      isBot: false 
    });

    // 🤖 SMART CONCIERGE RESPONSE (ZERO COST)
    let botReply = await getSupportBotResponse(message, role, userId);

    // If the bot decided to escalate, update the ticket status
    if (botReply.includes('[ESCALATED]')) {
        supportTicket.priority = (supportTicket.priority || 0) + 1;
        supportTicket.status = 'escalated';
        await supportTicket.save();
        // Clean the tag out of the message before showing the user
        botReply = botReply.replace('[ESCALATED]', '').trim();
    }

    const botChatId = uuid.v4();
    await SupportChat.create({
      id: botChatId, 
      supportId: ticketId, 
      userId: userId, // 🛡️ Linked to user to satisfy DB constraints
      senderId: 'bot', 
      message: botReply, 
      isBot: true 
    });

    res.status(201).json(supportTicket);
  } catch (error) {
    console.error("createSupportTicket Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

const addSupportMessage = async (req, res) => {
  try {
    const id = uuid.v4();
    const { supportId, message } = req.body;
    const senderId = req.user.id;

    // Correctly link userId to senderId for message ownership
    const supportMessage = await SupportChat.create({ 
      id, 
      supportId, 
      userId: senderId, 
      senderId, 
      message 
    });

    // 🤖 INTERACTIVE BOT FOLLOW-UP
    // If the user asks a specific data question in the middle of a chat, the bot can still help.
    const role = req.user.role || 'user';
    const botReply = await getSupportBotResponse(message, role, senderId);
    
    // Only send if the bot actually has something intelligent to say
    if (!botReply.includes("complex scenario")) {
        
        if (botReply.includes('[ESCALATED]')) {
            const supportTicket = await Support.findByPk(supportId);
            if (supportTicket) {
                supportTicket.priority = (supportTicket.priority || 0) + 1;
                supportTicket.status = 'escalated';
                await supportTicket.save();
            }
            botReply = botReply.replace('[ESCALATED]', '').trim();
        }

        await SupportChat.create({
            id: uuid.v4(),
            supportId,
            userId: senderId, // 🛡️ Linked to user to satisfy DB constraints
            senderId: 'bot',
            message: botReply,
            isBot: true
        });
    }

    res.status(201).json(supportMessage);
  } catch (error) {
    console.error("addSupportMessage Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

const escalateSupportTicket = async (req, res) => {
  try {
    const { supportId } = req.body;
    const supportTicket = await Support.findByPk(supportId);
    if (!supportTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    supportTicket.priority += 1;
    supportTicket.status = 'escalated';
    await supportTicket.save();
    res.status(200).json(supportTicket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const viewSupportChats = async (req, res) => {
  const checkData = (value) => {
    return value !== null && value !== undefined ? value : "Not Available"
  }
  try {
    const { supportId } = req.body;
    const supportChatsData = await SupportChat.findAll({ 
      where: { supportId: supportId },
      order: [['createdAt', 'ASC']]
    });
    const supportChats = supportChatsData.map((chat) => ({
      id: checkData(chat.id),
      supportId: checkData(chat.supportId),
      userId: checkData(chat.userId),
      adminId: checkData(chat.adminId),
      senderId: checkData(chat.senderId),
      message: checkData(chat.message),
      isBot: chat.isBot || false,
      createdAt: checkData(chat.createdAt),
      updatedAt: checkData(chat.updatedAt)
      }))
    if (!supportChats) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.status(200).json(supportChats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const resolveSupportTicket = async (req, res) => {
  try {
    const { supportId } = req.body;
    const supportTicket = await Support.findByPk(supportId);
    if (!supportTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    supportTicket.status = 'resolved';
    await supportTicket.save();

    // 🔔 Notify User
    await notifyUserById(
      supportTicket.userId,
      "Support Ticket Resolved",
      `Your ticket regarding "${supportTicket.subject}" has been marked as resolved.`,
      { supportId, type: "support_update", click_action: "FLUTTER_NOTIFICATION_CLICK" }
    );

    res.status(200).json(supportTicket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// View all support tickets
const viewSupportTickets = async (req, res) => {
    try {
      const tickets = await Support.findAll();
      res.status(200).json({ tickets });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error });
    }
  };
  
  const viewUserSupportTickets = async (req, res) => {
    try {
      const userId = req.user.id;
      const tickets = await Support.findAll({ where: {userId:userId}});
      res.status(200).json({ tickets });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error });
    }
  };
  // Reply to a support ticket
  const replyToSupportTicket = async (req, res) => {
    const { ticketId, reply } = req.body;
    try {
      const id = uuid.v4();
      const ticket = await Support.findByPk(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
      }
      await SupportChat.create({ id:id, supportId: ticketId, adminId: req.user.id, senderId: req.user.id,  message: reply  });
      ticket.status = 'Replied';
      await ticket.save();

      // 🔔 Notify User
      await notifyUserById(
        ticket.userId,
        "New Message from Support",
        `We have replied to your ticket: "${ticket.subject}". Check the chat for details.`,
        { supportId: ticketId, type: "support_reply", click_action: "FLUTTER_NOTIFICATION_CLICK" }
      );

      res.status(200).json({ message: 'Reply sent successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error });
    }
  };
  
module.exports = { createSupportTicket, viewSupportTickets,replyToSupportTicket,addSupportMessage, escalateSupportTicket, resolveSupportTicket, viewSupportChats, viewUserSupportTickets };
