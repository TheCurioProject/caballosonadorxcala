import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('DELETE FROM writers_workshops;');
  console.log('Deleted all workshops');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
