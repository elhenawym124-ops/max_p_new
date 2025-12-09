
require('dotenv').config();

console.log('--- ENV CHECK ---');
console.log('TELEGRAM_API_ID exists:', !!process.env.TELEGRAM_API_ID);
console.log('TELEGRAM_API_HASH exists:', !!process.env.TELEGRAM_API_HASH);
console.log('TELEGRAM_API_ID value type:', typeof process.env.TELEGRAM_API_ID);
console.log('--- END ENV CHECK ---');

try {
  const { TelegramClient } = require("telegram");
  console.log('telegram package loadable: YES');
} catch (e) {
  console.log('telegram package loadable: NO', e.message);
}
