const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const roomsDir = path.join(__dirname, 'rooms');
const publicRoomsDir = path.join(__dirname, 'public', 'rooms');

if (!fs.existsSync(publicRoomsDir)) {
    fs.mkdirSync(publicRoomsDir, { recursive: true });
}

async function convertImages() {
    const subdirs = fs.readdirSync(roomsDir).filter(f => fs.statSync(path.join(roomsDir, f)).isDirectory());
    
    for (const subdir of subdirs) {
        const sourceDir = path.join(roomsDir, subdir);
        const targetDir = path.join(publicRoomsDir, subdir.replace(' ', ''));
        
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const files = fs.readdirSync(sourceDir).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
        
        for (const file of files) {
            const sourcePath = path.join(sourceDir, file);
            const targetName = file.replace(/\.[^/.]+$/, "") + '.webp';
            const targetPath = path.join(targetDir, targetName);
            
            console.log(`Converting ${sourcePath} to ${targetPath}`);
            await sharp(sourcePath)
                .webp({ quality: 80 })
                .toFile(targetPath);
        }
    }
    console.log('Done converting images');
}

convertImages().catch(console.error);
