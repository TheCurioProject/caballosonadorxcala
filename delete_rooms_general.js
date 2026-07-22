const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const img = await prisma.siteImage.findFirst({
    where: { group: 'ROOMS GENERAL' }
  });
  if (img) {
    console.log('Found image, deleting...', img.key);
    await prisma.siteImageHistory.deleteMany({
      where: { siteImageId: img.id }
    });
    await prisma.siteImage.delete({
      where: { id: img.id }
    });
    console.log('Deleted successfully.');
  } else {
    console.log('Image not found in DB.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
