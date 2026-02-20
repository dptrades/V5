const http = require('http');
http.get('http://localhost:3000/api/ohlcv?symbol=AAPL&interval=1d', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.data) {
        console.log(JSON.stringify(json.data.slice(-5), null, 2));
      } else {
        console.log("No data array found:", json);
      }
    } catch(e) {
      console.log("Raw response:", data.substring(0, 200));
    }
  });
});
