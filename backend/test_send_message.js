const axios = require('axios');

async function testSendMessage() {
    try {
        const BASE_URL = 'http://localhost:3007/api/v1';
        const RECIPIENT_PHONE = '201112257060'; // Egypt code +20 added to 01112257060

        // 1. Login
        console.log('🔐 Logging in as ali@ali.com...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'ali@ali.com',
            password: 'password123'
        });

        const token = loginRes.data.data.token;
        console.log('✅ Login successful');
        const headers = { Authorization: `Bearer ${token}` };

        // 2. Get Sessions to find the connected one
        console.log('📱 Finding connected session...');
        const sessionsRes = await axios.get(`${BASE_URL}/whatsapp/sessions`, { headers });
        const sessions = sessionsRes.data.sessions;
        const connectedSession = sessions.find(s => s.status === 'CONNECTED');

        if (!connectedSession) {
            console.error('❌ No connected session found! Please scan QR code first.');
            return;
        }

        console.log(`✅ Using session: ${connectedSession.name} (${connectedSession.id})`);

        // 3. Send Message
        console.log(`📤 Sending message to ${RECIPIENT_PHONE}...`);
        const messagePayload = {
            sessionId: connectedSession.id,
            to: RECIPIENT_PHONE,
            text: 'Hello from MaxBot API Test! 🚀'
        };

        try {
            const sendRes = await axios.post(`${BASE_URL}/whatsapp/messages/send`, messagePayload, { headers });
            console.log('✅ Message sent successfully:', sendRes.data);
        } catch (e) {
            console.error('❌ Failed to send message:', e.response?.data || e.message);
        }

    } catch (error) {
        console.error('❌ Critical Error:', error.message);
    }
}

testSendMessage();
