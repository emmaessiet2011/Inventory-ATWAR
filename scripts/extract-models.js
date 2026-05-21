import fs from 'fs';
import path from 'path';

const schemaPath = 'c:/Users/essie/OneDrive/Desktop/Inventory-ATWAR-main/prisma/schema.prisma';
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Quick extraction of StockTransfer and StockAdjustment models
function extractModel(modelName) {
  const regex = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\}`, 'g');
  const match = regex.exec(schemaContent);
  if (match) console.log(match[0] + '\n');
}

console.log("--- Models ---");
extractModel('StockTransfer');
extractModel('StockTransferItem');
extractModel('StockAdjustment');
extractModel('StockAdjustmentItem');
extractModel('StockLedger');
