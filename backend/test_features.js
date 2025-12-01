
const axios = require('axios');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('Using DATABASE_URL:', process.env.DATABASE_URL);

const bcrypt = require('bcryptjs');

const API_URL = 'http://localhost:3009/api/v1/whatsapp';
const EMAIL = 'ali@ali.com';
const PASSWORD = 'password123';

async function testFeatures() {
    try {
        console.log('🚀 Starting Feature Tests...');

        // 1. Login
        console.log('🔑 Logging in...');
        const loginRes = await axios.post('http://localhost:3009/api/v1/auth/login', {
            email: EMAIL,
            password: PASSWORD
        });
        const token = loginRes.data.data.token;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Logged in');

        // 2. Get Sessions
        console.log('📱 Getting sessions...');
        let session;
        for (let i = 0; i < 10; i++) {
            const sessionsRes = await axios.get(`${API_URL}/sessions`, { headers });
            // console.log('Sessions found:', sessionsRes.data.sessions.map(s => ({ id: s.id, status: s.status, liveStatus: s.liveStatus })));
            session = sessionsRes.data.sessions.find(s => s.status === 'CONNECTED' || s.liveStatus === 'connected');
            if (session) break;
            console.log(`⏳ Waiting for session to connect... (${i + 1}/10)`);
            await new Promise(r => setTimeout(r, 3000));
        }

        if (!session) {
            console.error('❌ No connected session found after waiting. Please connect a session first.');
            return;
        }
        const sessionId = session.id;
        console.log(`✅ Using session: ${sessionId}`);

        // 3. Send a Message
        console.log('📨 Sending test message...');
        const to = '201112257060';

        async function sendMessageWithRetry(sessionId, to, text) {
            const maxRetries = 3;
            for (let i = 0; i < maxRetries; i++) {
                try {
                    const response = await axios.post(`${API_URL}/messages/send`, {
                        sessionId,
                        to,
                        text
                    }, { headers });
                    return response.data;
                } catch (error) {
                    if (i === maxRetries - 1) throw error;
                    console.log(`⚠️ Send failed, retrying (${i + 1}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }
        }

        const sendRes = await sendMessageWithRetry(sessionId, to, 'Test message for features');
        const message = sendRes.message;
        console.log(`✅ Message sent: ${message.messageId}`);

        // Wait a bit
        await new Promise(r => setTimeout(r, 2000));

        // 4. Edit Message
        console.log('✏️ Testing Edit Message...');
        try {
            await axios.post(`${API_URL}/messages/edit`, {
                sessionId,
                to,
                key: { remoteJid: `${to}@s.whatsapp.net`, fromMe: true, id: message.messageId },
                newText: 'Test message EDITED'
            }, { headers });
            console.log('✅ Edit Message successful');
        } catch (e) {
            console.error('❌ Edit Message failed:', e.response?.data || e.message);
        }

        // Wait a bit
        await new Promise(r => setTimeout(r, 2000));

        // 5. Delete Message
        console.log('🗑️ Testing Delete Message...');
        try {
            await axios.post(`${API_URL}/messages/delete`, {
                sessionId,
                to,
                key: { remoteJid: `${to}@s.whatsapp.net`, fromMe: true, id: message.messageId }
            }, { headers });
            console.log('✅ Delete Message successful');
        } catch (e) {
            console.error('❌ Delete Message failed:', e.response?.data || e.message);
        }

        // 6. Test Chat Actions (Archive)
        console.log('📂 Testing Archive Chat...');
        try {
            await axios.post(`${API_URL}/chats/archive`, {
                sessionId,
                jid: `${to}@s.whatsapp.net`,
                archive: true
            }, { headers });
            console.log('✅ Archive Chat successful');

            // Unarchive
            await axios.post(`${API_URL}/chats/archive`, {
                sessionId,
                jid: `${to}@s.whatsapp.net`,
                archive: false
            }, { headers });
            console.log('✅ Unarchive Chat successful');
        } catch (e) {
            console.error('❌ Archive Chat failed:', e.response?.data || e.message);
        }

        // 7. Test Chat Actions (Pin)
        console.log('📌 Testing Pin Chat...');
        try {
            await axios.post(`${API_URL}/chats/pin`, {
                sessionId,
                jid: `${to}@s.whatsapp.net`,
                pin: true
            }, { headers });
            console.log('✅ Pin Chat successful');
            // Unpin
            await axios.post(`${API_URL}/chats/pin`, {
                sessionId,
                jid: `${to}@s.whatsapp.net`,
                pin: false
            }, { headers });
            console.log('✅ Unpin Chat successful');
        } catch (e) {
            console.error('❌ Pin Chat failed:', e.response?.data || e.message);
        }

        // 8. Clear Chat
        console.log('🧹 Testing Clear Chat...');
        try {
            await axios.post(`${API_URL}/chats/clear`, {
                sessionId,
                jid: `${to}@s.whatsapp.net`
            }, { headers });
            console.log('✅ Clear Chat successful');
        } catch (e) {
            console.error('❌ Clear Chat failed:', e.response?.data || e.message);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        await prisma.$disconnect();
    }
}

testFeatures();
