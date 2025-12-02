require('dotenv').config();
const { getSharedPrismaClient } = require('./services/sharedDatabase');
const WhatsAppMessageHandler = require('./services/whatsapp/WhatsAppMessageHandler');

async function sendTestMessage() {
    const sessionId = 'cminpms7r002eufvkd4kvfoin';
    const to = '01112257060';
    const text = 'Test message from system check - ' + new Date().toISOString();

    try {
        console.log(`🚀 Sending message...`);
        console.log(`From Session: ${sessionId}`);
        console.log(`To: ${to}`);
        console.log(`Text: ${text}`);

        const result = await WhatsAppMessageHandler.sendText(sessionId, to, text);

        console.log('✅ Message Sent Successfully!');
        console.log('Message ID:', result.messageId);
        console.log('Status:', result.status);

    } catch (error) {
        console.error('❌ Failed to send message:', error.message);
    } finally {
        // await getSharedPrismaClient().$disconnect();
        process.exit(0);
    }
}

sendTestMessage();
