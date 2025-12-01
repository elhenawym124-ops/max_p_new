/**
 * 📱 WhatsApp API Test with Token
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3007/api/v1';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWVtOGF6bHYwMDRldWZha2JrbzB3bW4xIiwiZW1haWwiOiJhbGlAYWxpLmNvbSIsInJvbGUiOiJDT01QQU5ZX0FETUlOIiwiY29tcGFueUlkIjoiY21lbThheXlyMDA0Y3VmYWtxa2NzeW45NyIsImlhdCI6MTc2NDQ5MzE3NCwiZXhwIjoxNzY0NTc5NTc0fQ.4SREuMyxdiIdIz187qqHRDTeHppWGKRG3ssC9mUCxQs';

async function test() {
  console.log('\n📱 WhatsApp API Test with Authentication\n');
  console.log('═'.repeat(60));
  
  const endpoints = [
    { method: 'GET', path: '/whatsapp/sessions', name: 'Get Sessions' },
    { method: 'GET', path: '/whatsapp/settings', name: 'Get Settings' },
    { method: 'GET', path: '/whatsapp/quick-replies', name: 'Get Quick Replies' },
    { method: 'GET', path: '/whatsapp/stats', name: 'Get Stats' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios({
        method: endpoint.method,
        url: `${BASE_URL}${endpoint.path}`,
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      });
      
      const status = response.status;
      let statusText = '';
      let data = '';
      
      if (status === 200) {
        statusText = '✅ OK';
        data = JSON.stringify(response.data, null, 2).substring(0, 200);
      } else if (status === 401) {
        statusText = '🔐 Auth Error';
        data = response.data?.message || '';
      } else if (status === 404) {
        statusText = '❌ Not Found';
      } else if (status === 500) {
        statusText = '💥 Server Error';
        data = response.data?.error || response.data?.message || '';
      } else {
        statusText = `⚠️ ${status}`;
        data = JSON.stringify(response.data).substring(0, 100);
      }
      
      console.log(`\n${endpoint.name} (${endpoint.method} ${endpoint.path})`);
      console.log(`Status: ${statusText}`);
      if (data) console.log(`Response: ${data}...`);
      
    } catch (error) {
      console.log(`\n${endpoint.name} (${endpoint.method} ${endpoint.path})`);
      console.log(`Status: ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '═'.repeat(60));
  
  // Test creating a session
  console.log('\n📱 Testing Create Session...\n');
  try {
    const createRes = await axios({
      method: 'POST',
      url: `${BASE_URL}/whatsapp/sessions`,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Test Session ' + Date.now(),
        aiEnabled: true,
        autoReply: false,
        aiMode: 'suggest'
      },
      validateStatus: () => true
    });
    
    console.log(`Create Session Status: ${createRes.status}`);
    console.log(`Response: ${JSON.stringify(createRes.data, null, 2)}`);
  } catch (error) {
    console.log(`Create Session Error: ${error.message}`);
  }
}

test();
