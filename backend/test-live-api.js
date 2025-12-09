const http = require('http');

// Test the actual API endpoint
const options = {
  hostname: 'localhost',
  port: 3007,
  path: '/api/v1/orders-new/simple?page=1&limit=5',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer test-token' // Will fail auth but we can see the response
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('\n🔍 ===== LIVE API RESPONSE =====\n');
      
      if (response.data && Array.isArray(response.data)) {
        response.data.slice(0, 5).forEach((order, index) => {
          console.log(`Order #${index + 1}: ${order.orderNumber}`);
          console.log(`  customerName: "${order.customerName}"`);
          console.log(`  customerPhone: "${order.customerPhone}"`);
          console.log('');
        });
      } else {
        console.log('Response:', JSON.stringify(response, null, 2));
      }
    } catch (error) {
      console.error('Error parsing response:', error.message);
      console.log('Raw response:', data);
    }
    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error('Request error:', error.message);
  process.exit(1);
});

req.end();
