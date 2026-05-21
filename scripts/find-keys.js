import fs from 'fs';
import path from 'path';

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = dir + '/' + file;
    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const fileContent = fs.readFileSync(fullPath, 'utf8');
      if (fileContent.includes('syncRecordStrict')) {
        console.log(`Found syncRecordStrict in ${fullPath}`);
        // Find matching lines
        const lines = fileContent.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('syncRecordStrict') && (line.includes('export const') || line.includes('function') || line.includes('const syncRecordStrict'))) {
            console.log(`  Line ${index + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

scanDir('c:/Users/essie/OneDrive/Desktop/Inventory-ATWAR-main/src');
