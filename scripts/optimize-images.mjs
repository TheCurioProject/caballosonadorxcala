import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const PUBLIC_DIR = path.join(process.cwd(), 'public', 'imagenes');
const MAX_WIDTH = 1920;
const QUALITY = 80;

async function getFiles(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

async function optimizeImages() {
  try {
    const allFiles = await getFiles(PUBLIC_DIR);
    const imageFiles = allFiles.filter(f => /\.(jpe?g|png|webp)$/i.test(f));
    
    console.log(`Found ${imageFiles.length} images to check.`);
    
    for (const file of imageFiles) {
      const stats = await fs.stat(file);
      const sizeInMB = stats.size / (1024 * 1024);
      
      // Target images larger than 500KB
      if (stats.size > 500 * 1024) {
        console.log(`Optimizing: ${path.basename(file)} (${sizeInMB.toFixed(2)} MB)`);
        
        const tmpFile = `${file}.tmp`;
        const ext = path.extname(file).toLowerCase();
        
        let sharpInstance = sharp(file).resize({ width: MAX_WIDTH, withoutEnlargement: true });
        
        if (ext === '.jpg' || ext === '.jpeg') {
          sharpInstance = sharpInstance.jpeg({ quality: QUALITY, progressive: true });
        } else if (ext === '.png') {
          sharpInstance = sharpInstance.png({ quality: QUALITY, compressionLevel: 9 });
        } else if (ext === '.webp') {
          sharpInstance = sharpInstance.webp({ quality: QUALITY });
        }
        
        await sharpInstance.toFile(tmpFile);
        
        const newStats = await fs.stat(tmpFile);
        const newSizeInMB = newStats.size / (1024 * 1024);
        
        if (newStats.size < stats.size) {
          await fs.rename(tmpFile, file);
          console.log(`  -> Reduced to ${newSizeInMB.toFixed(2)} MB`);
        } else {
          await fs.unlink(tmpFile);
          console.log(`  -> Size not reduced, keeping original.`);
        }
      }
    }
    
    console.log('Image optimization complete.');
  } catch (error) {
    console.error('Error optimizing images:', error);
  }
}

optimizeImages();
