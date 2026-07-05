const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = path.join(__dirname, 'public/imagenes/03_rooms');

async function main() {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.jpg') || file.endsWith('.png')) {
      const inputPath = path.join(dir, file);
      const outputPath = path.join(dir, file.replace(/\.(jpg|png)$/, '.webp'));
      
      console.log(`Converting ${file} to WebP...`);
      await sharp(inputPath)
        .webp({ quality: 80 })
        .toFile(outputPath);
    }
  }
  console.log('Conversion complete.');
}

main().catch(console.error);
