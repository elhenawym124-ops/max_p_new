const axios = require('axios');

async function verifyApi() {
    try {
        const BASE_URL = 'http://localhost:3007/api/v1';

        // 1. Login
        console.log('🔐 Logging in as ali@ali.com...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'ali@ali.com',
            password: 'password123'
        });

        const token = loginRes.data.data.token;
        console.log('✅ Login successful, Token:', token ? token.substring(0, 20) + '...' : 'null');

        const headers = { Authorization: `Bearer ${token}` };

        // 2. Get Settings
        console.log('⚙️ Fetching WhatsApp settings...');
        try {
            const settingsRes = await axios.get(`${BASE_URL}/whatsapp/settings`, { headers });
            console.log('✅ Settings fetched:', settingsRes.data);
        } catch (e) {
            console.error('❌ Settings failed:', e.response?.data || e.message);
        }

        // 3. Get Sessions
        console.log('📱 Fetching WhatsApp sessions...');
        try {
            const sessionsRes = await axios.get(`${BASE_URL}/whatsapp/sessions`, { headers });
            console.log('✅ Sessions fetched:', JSON.stringify(sessionsRes.data, null, 2));
        } catch (e) {
            console.error('❌ Sessions failed:', e.response?.data || e.message);
        }

        // 4. Get Stats
        console.log('📊 Fetching WhatsApp stats...');
        try {
            const statsRes = await axios.get(`${BASE_URL}/whatsapp/stats`, { headers });
            console.log('✅ Stats fetched:', JSON.stringify(statsRes.data, null, 2));
        } catch (e) {
            console.error('❌ Stats failed:', e.response?.data || e.message);
        }

    } catch (error) {
        console.error('❌ Critical Error:', error.code || error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

verifyApi();
