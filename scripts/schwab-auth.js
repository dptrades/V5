const axios = require('axios');
const fs = require('fs');
const path = require('path');

let clientId = '';
let clientSecret = '';
try {
    const envContent = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
    clientId = envContent.match(/SCHWAB_CLIENT_ID="(.+)"/)?.[1] || '';
    clientSecret = envContent.match(/SCHWAB_CLIENT_SECRET="(.+)"/)?.[1] || '';
} catch (e) {
    console.error('Could not read .env.local.');
    process.exit(1);
}

const redirectUri = 'https://127.0.0.1';
let code = process.argv[2];

if (!code) {
    console.log('\n--- Schwab OAuth2 Setup ---\n');
    console.log('1. Visit: https://api.schwabapi.com/v1/oauth/authorize?client_id=' + clientId + '&redirect_uri=' + redirectUri);
    console.log('\n2. Run: node scripts/schwab-auth.js YOUR_CODE_HERE\n');
    process.exit(0);
}

// Extract only the code part if the user pasted the whole URL/redirect
if (code.includes('code=')) {
    code = code.split('code=')[1].split('&')[0];
} else if (code.includes('&')) {
    code = code.split('&')[0];
}

code = decodeURIComponent(code);

async function exchangeToken() {
    try {
        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const response = await axios.post('https://api.schwabapi.com/v1/oauth/token',
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri
            }),
            {
                headers: {
                    'Authorization': `Basic ${authHeader}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                }
            }
        );

        if (response.data.refresh_token) {
            console.log('\n✅ Success! Tokens received.');
            console.log('\n--- Copy this into your .env.local ---');
            console.log(`SCHWAB_REFRESH_TOKEN="${response.data.refresh_token}"`);
            console.log('--------------------------------------\n');
        } else {
            console.error('\n❌ Error response:', response.data);
        }
    } catch (error) {
        console.error('\n❌ Token exchange failed:', error.response?.data || error.message);
    }
}

exchangeToken();
