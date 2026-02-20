const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'data', 'tracked_options.json');
const content = fs.readFileSync(file, 'utf8');
const options = JSON.parse(content);
const id = "TSLA";
const updated = options.filter(o => o.id !== id);
console.log(`Original: ${options.length}, Updated: ${updated.length}`);
