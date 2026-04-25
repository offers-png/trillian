/**
 * TRILLIAN — Telegram Integration
 * Receive messages via Telegram bot, process with Claude, respond
 */
const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;

async function sendMessage(chatId, text) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not set');
  
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  });
}

async function setWebhook(url) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not set');
  
  const webhookUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
  const res = await axios.post(webhookUrl, { url });
  console.log('[TELEGRAM] Webhook set:', res.data);
  return res.data;
}

async function handleUpdate(update) {
  const message = update.message;
  if (!message || !message.text) return {};
  
  const chatId = message.chat.id;
  const text = message.text;
  const userId = message.from.id;
  
  console.log('[TELEGRAM] Message from', message.from.username || userId, ':', text);
  
  return { chatId, text, userId };
}

module.exports = { sendMessage, setWebhook, handleUpdate };
