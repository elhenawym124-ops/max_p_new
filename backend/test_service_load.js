
const service = require('./services/TelegramUserbotService');
console.log('Service loaded successfully:', !!service);
console.log('Methods available:', Object.getOwnPropertyNames(Object.getPrototypeOf(service)));
