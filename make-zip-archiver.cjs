const fs = require('fs');
const archiver = require('archiver');
const path = require('path');

const output = fs.createWriteStream(path.join(__dirname, 'Inventory-ATWAR-dist-fixed.zip'));
const archive = archiver.create('zip', { zlib: { level: 9 } });

output.on('close', function() {
  console.log('Zip file created successfully. Total bytes: ' + archive.pointer());
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

// Append files from a directory, putting its contents at the root of archive
archive.directory('dist/', 'dist');

archive.finalize();
