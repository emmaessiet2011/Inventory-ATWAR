import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all products from Postgres...');
  const products = await prisma.product.findMany();
  
  let recoveredCount = 0;
  
  for (const product of products) {
    let meta = product.meta || {};
    // Prisma returns Json as object usually, but let's be safe
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch (e) {}
    }
    
    const locNames = Array.isArray(meta.availableLocations) ? meta.availableLocations : [];
    
    if (locNames.length > 0) {
      const hasWarehouse = locNames.some(l => l.toLowerCase() === 'warehouse' || l.toLowerCase() === 'atwar al mustaqbal');
      
      // If it has 'Warehouse' and a small number of locations, it was highly likely hit by the stock transfer bug.
      if (hasWarehouse && locNames.length <= 4 && !meta.businessLocation) {
        console.log(`Recovering bugged product: ${product.name} (Was hidden at: ${locNames.join(', ')})`);
        
        meta.availableLocations = [];
        meta.availableLocationIds = [];
        
        await prisma.product.update({
          where: { id: product.id },
          data: { meta }
        });
        
        recoveredCount++;
      }
    }
  }
  
  console.log(`\nSUCCESS: Recovered ${recoveredCount} bugged products back to global visibility.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
