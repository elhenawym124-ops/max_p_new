const axios = require('axios');

const API_URL = 'http://localhost:3007/api/v1/telegram-settings/connect';
const payload = {
    companyId: 'cmem8ayyr004cufakqkcsyn97',
    botToken: '8547460022:AAEbWBpQu88dR7ZEBtdxaS6JDNKX70b9I34',
    label: 'Test Bot Verification'
};

async function testConnect() {
    try {
        console.log('🚀 Sending request to:', API_URL);
        const response = await axios.post(API_URL, payload);
        console.log('✅ Success:', response.data);
    } catch (error) {
        if (error.response) {
            console.error('❌ Error Response:', error.response.status, error.response.data);
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

testConnect();
