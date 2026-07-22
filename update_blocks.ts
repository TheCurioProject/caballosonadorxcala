import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.blockedDate.updateMany({
    where: { reason: 'Bloqueo manual' },
    data: { reason: 'Manual block' }
  });
  console.log('Updated blocks:', result);
}

main().catch(console.error).finally(() => prisma.$disconnect());
