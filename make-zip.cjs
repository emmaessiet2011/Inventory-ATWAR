const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function createZip() {
  const zip = new JSZip();
  const distPath = path.join(__dirname, 'dist');
  
  function addDirectoryToZip(dirPath, zipFolder) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const newFolder = zipFolder.folder(file);
        addDirectoryToZip(fullPath, newFolder);
      } else {
        const content = fs.readFileSync(fullPath);
        zipFolder.file(file, content);
      }
    }
  }

  addDirectoryToZip(distPath, zip);
  
  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(path.join(__dirname, 'Inventory-Fix.zip'), content);
  console.log('Successfully created Inventory-Fix.zip with correct Linux paths!');
}

createZip().catch(console.error);
