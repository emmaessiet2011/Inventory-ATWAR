const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body || '{}'));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function main() {
  console.log('Fetching products from local API (http://localhost:4000/api/sync/products)...');
  try {
    const data = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/sync/products',
      method: 'GET'
    });
    
    // The API returns an object with ids as keys
    let recoveredCount = 0;
    
    for (const [id, product] of Object.entries(data)) {
      const locNames = Array.isArray(product.availableLocations) ? product.availableLocations : [];
      
      if (locNames.length > 0) {
        const hasWarehouse = locNames.some(l => l.toLowerCase() === 'warehouse' || l.toLowerCase() === 'atwar al mustaqbal');
        
        if (hasWarehouse && locNames.length <= 4 && !product.businessLocation) {
          console.log(`Recovering product: ${product.name} (Was restricted to: ${locNames.join(', ')})`);
          
          product.availableLocations = [];
          product.availableLocationIds = [];
          
          // Sync it back
          await request({
            hostname: 'localhost',
            port: 4000,
            path: `/api/sync/products/${id}`,
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            }
          }, product);
          
          recoveredCount++;
        }
      }
    }
    console.log(`\nSUCCESS: Recovered ${recoveredCount} products. They are now globally visible again!`);
  } catch (err) {
    console.error('Failed:', err.message);
  }
}

main();
