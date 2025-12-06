const axios = require('axios');
const crypto = require('crypto');

// Configuration
// You might need to change this if your server is running on a different port
const API_URL = 'http://localhost:3000/api/v1/woocommerce/webhook';
const COMPANY_ID = 'user-company-id-placeholder'; // Need to find a valid company ID
const WEBHOOK_SECRET = 'test_secret'; // Use a test secret or try to fetch from DB

// Mock WooCommerce Order Payload
const mockOrder = {
    id: 12345,
    order_key: 'wc_order_12345abcdef',
    status: 'processing',
    currency: 'EGP',
    date_created: new Date().toISOString(),
    date_paid: new Date().toISOString(),
    discount_total: '0.00',
    shipping_total: '50.00',
    total: '550.00',
    total_tax: '0.00',
    billing: {
        first_name: 'Test',
        last_name: 'Customer',
        email: 'test@example.com',
        phone: '01000000001',
        address_1: '123 Test St',
        city: 'Cairo'
    },
    payment_method: 'cod',
    line_items: [
        {
            id: 111,
            name: 'Test Product',
            product_id: 999,
            quantity: 1,
            subtotal: '500.00',
            total: '500.00',
            sku: 'TEST-SKU-001',
            price: 500
        }
    ]
};

async function testWebhook() {
    try {
        // calculate signature
        const payload = JSON.stringify(mockOrder);
        const signature = crypto
            .createHmac('sha256', WEBHOOK_SECRET)
            .update(payload, 'utf8')
            .digest('base64');

        console.log(`Sending webhook to ${API_URL}/${COMPANY_ID}`);
        console.log(`Topic: order.created`);
        console.log(`Signature: ${signature}`);

        const response = await axios.post(`${API_URL}/${COMPANY_ID}`, mockOrder, {
            headers: {
                'x-wc-webhook-topic': 'order.created',
                'x-wc-webhook-signature': signature,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testWebhook();
