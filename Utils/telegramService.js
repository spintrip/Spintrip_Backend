const axios = require('axios');
require('dotenv').config();

// TODO: Replace these with your actual Telegram Bot Token and Chat ID.
// Ideally, move these to your .env file like: process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Sends a notification message to a Telegram group.
 * @param {string} message - The message text to send.
 */
const sendTelegramAlert = async (message) => {
  try {
    if (TELEGRAM_BOT_TOKEN ===  undefined || TELEGRAM_CHAT_ID === undefined) {
      console.log("⚠️ Telegram Bot Token is not configured. Skipping alert.");
      return;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML' // Allows using <b>, <i>, etc. in the message
    });

    console.log("✅ Telegram alert sent successfully!");
  } catch (error) {
    const tgError = error.response?.data?.description || error.message;
    console.error("❌ Failed to send Telegram alert:", tgError);
  }
};

module.exports = {
  sendTelegramAlert
};
