const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const s1 = await prisma.servicePricing.create({
    data: {
      serviceType: 'FOOD_PRICE',
      name: JSON.stringify({ en: 'Dinner Service (6 to 8 people)', es: 'Servicio de Cena (6 a 8 personas)' }),
      description: JSON.stringify({ en: 'Dinner Service for 6 to 8 people', es: 'Servicio de Cena para 6 a 8 personas' }),
      price: 3200
    }
  });
  console.log('Created:', s1);

  const s2 = await prisma.servicePricing.create({
    data: {
      serviceType: 'FOOD_PRICE',
      name: JSON.stringify({ en: 'Dinner Service (10 to 12 people)', es: 'Servicio de Cena (10 a 12 personas)' }),
      description: JSON.stringify({ en: 'Dinner Service for 10 to 12 people', es: 'Servicio de Cena para 10 a 12 personas' }),
      price: 4200
    }
  });
  console.log('Created:', s2);
}

main().catch(console.error).finally(() => prisma.$disconnect());
