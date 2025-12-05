const jwt = require('jsonwebtoken');
const http = require('http');

const secret = 'your-super-secret-jwt-key-change-in-production';
const payload = {
    id: 'cmem8azlv004eufakbko0wmn1',
    companyId: 'cmem8ayyr004cufakqkcsyn97',
    role: 'COMPANY_ADMIN'
};
const token = jwt.sign(payload, secret, { expiresIn: '1h' });

const postData = JSON.stringify({
    sessionId: 'cmintez5r0042ufxwank74fox',
    to: '201123087139',
    text: 'Test message from debugger ' + new Date().toISOString()
});

const options = {
    hostname: 'localhost',
    port: 3007,
    path: '/api/v1/whatsapp/messages/send',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

// Write data to request body
req.write(postData);
req.end();
