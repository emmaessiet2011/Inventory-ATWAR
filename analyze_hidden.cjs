const fs = require('fs');
const path = require('path');

const apiFile = path.join(__dirname, 'server', 'data', 'api_db.json');
if (!fs.existsSync(apiFile)) {
    console.log('Database file not found.');
    process.exit(1);
}

const db = JSON.parse(fs.readFileSync(apiFile, 'utf8'));
const products = db['/api/sync/products'] || {};

let buggedCount = 0;
let intentionallyHiddenCount = 0;

console.log('--- Hidden Products Analysis ---');

for (const id in products) {
    const p = products[id];
    const locNames = Array.isArray(p.availableLocations) ? p.availableLocations : [];
    
    if (locNames.length > 0) {
        // Did it get hit by the bug? The bug usually injects 'Warehouse' and 'atwar al mustaqbal'
        const hasWarehouse = locNames.some(l => l.toLowerCase() === 'warehouse' || l.toLowerCase() === 'atwar al mustaqbal');
        
        if (hasWarehouse && locNames.length <= 4) {
            console.log(`[BUGGED?] Product: ${p.name} | Hidden Locations: ${locNames.join(', ')}`);
            buggedCount++;
        } else {
            console.log(`[MANUAL?] Product: ${p.name} | Hidden Locations: ${locNames.join(', ')}`);
            intentionallyHiddenCount++;
        }
    }
}

console.log('--------------------------------');
console.log(`Found ${buggedCount} likely bugged products.`);
console.log(`Found ${intentionallyHiddenCount} likely manually hidden products.`);
