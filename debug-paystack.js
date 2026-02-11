
const https = require('https');

const PAYSTACK_SECRET_KEY = 'sk_test_75f6a70b6f18d0692bd85e194e7826ae449f6de1';

function initializePayment(params) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: '/transaction/initialize',
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', error => {
            reject(error);
        });

        req.write(JSON.stringify(params));
        req.end();
    });
}

async function runtrace() {
    console.log('Testing Paystack Connection...');
    console.log('Key:', PAYSTACK_SECRET_KEY.slice(0, 10) + '...');

    try {
        const result = await initializePayment({
            email: 'debug_test@example.com',
            amount: 500000,
            reference: 'DBG_' + Date.now(),
            callback_url: 'http://localhost:3000/booking/confirm'
        });
        console.log('✅ Paystack Init Success!');
        console.log('Auth URL:', result.data.authorization_url);
    } catch (err) {
        console.error('❌ Paystack Init Failed');
        console.error('Status:', err.status);
        console.error('Body:', err.body);
    }
}

runtrace();
