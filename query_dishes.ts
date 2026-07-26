import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const items = await prisma.servicePricing.findMany();
  items.forEach(d => console.log(`Type: ${d.serviceType} | Name: ${d.name} | Desc: ${d.description}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
