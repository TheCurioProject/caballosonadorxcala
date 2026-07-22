const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const images = await prisma.siteImage.findMany({
    where: { url: { startsWith: 'data:image' } }
  });
  
  let totalBytes = 0;
  for (const img of images) {
    totalBytes += img.url.length;
  }
  
  console.log(`Total Base64 images: ${images.length}`);
  console.log(`Total size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
