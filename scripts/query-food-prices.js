const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const prices = await prisma.servicePricing.findMany({ where: { serviceType: 'FOOD_PRICE' } })
  console.log(prices)
}
main().then(async () => { await prisma.$disconnect() }).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
