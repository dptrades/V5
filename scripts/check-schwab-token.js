const axios = require('axios');
const fs = require('fs');
const path = require('path');

let clientId = '';
let clientSecret = '';
let refreshToken = '';

try {
    const envContent = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
    clientId = envContent.match(/SCHWAB_CLIENT_ID="?([^"\n]+)"?/)?.[1] || '';
    clientSecret = envContent.match(/SCHWAB_CLIENT_SECRET="?([^"\n]+)"?/)?.[1] || '';
    refreshToken = envContent.match(/SCHWAB_REFRESH_TOKEN="?([^"\n]+)"?/)?.[1] || '';
} catch (e) {
    console.error('Could not read .env.local:', e.message);
    process.exit(1);
}

// Clean quotes if regex captured them
clientId = clientId.trim().replace(/^"|"$/g, '');
clientSecret = clientSecret.trim().replace(/^"|"$/g, '');
refreshToken = refreshToken.trim().replace(/^"|"$/g, '');

console.log('Client ID length:', clientId.length);
console.log('Client Secret length:', clientSecret.length);
console.log('Refresh Token length:', refreshToken.length);

if (!clientId || !clientSecret || !refreshToken) {
    console.error('Missing configuration in .env.local');
    process.exit(1);
}

async function checkToken() {
    try {
        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const response = await axios.post('https://api.schwabapi.com/v1/oauth/token',
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret
            }),
            {
                headers: {
                    'Authorization': `Basic ${authHeader}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }
        );

        if (response.data.access_token) {
            console.log('\n✅ Success! Schwab token refreshed successfully.');
            console.log('Access token expires in:', response.data.expires_in, 'seconds');
        } else {
            console.error('\n❌ Unexpected response:', response.data);
        }
    } catch (error) {
        console.error('\n❌ Refresh Token failed:', error.response?.data || error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        }
    }
}

checkToken();
