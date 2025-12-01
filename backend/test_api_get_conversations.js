
require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:3007/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
console.log('🔑 JWT_SECRET loaded:', !!process.env.JWT_SECRET);
if (process.env.JWT_SECRET) {
    console.log('🔑 JWT_SECRET length:', process.env.JWT_SECRET.length);
} else {
    console.log('⚠️ Using default secret key');
}

// User data from logs
const user = {
    id: 'cmem8azlv004eufakbko0wmn1',
    email: 'ali@ali.com',
    role: 'COMPANY_ADMIN',
    companyId: 'cmem8ayyr004cufakqkcsyn97'
};

// Generate Token
const token = jwt.sign(
    {
        userId: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId
    },
    JWT_SECRET,
    { expiresIn: '1h' }
);

console.log('🔑 Generated Token:', token.substring(0, 20) + '...');

async function testGetConversations() {
    try {
        console.log('🚀 Sending request to /whatsapp/conversations...');
        const sessionId = 'cmimbo3jg0024uf6kjj5bed1r'; // From user logs

        const response = await axios.get(`${API_URL}/whatsapp/conversations`, {
            params: { sessionId },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('✅ Success:', response.status);
        console.log('📦 Data:', response.data.conversations.length, 'conversations');
    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.status : error.message);
        if (error.response && error.response.data) {
            console.error('🔥 Error Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testGetConversations();
