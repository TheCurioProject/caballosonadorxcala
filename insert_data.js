const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.servicePricing.createMany({
    data: [
      { serviceType: 'FOOD', name: 'Desayuno', price: 25, isActive: true },
      { serviceType: 'FOOD', name: 'Desayuno y Comida', price: 45, isActive: true },
      { serviceType: 'FOOD', name: 'Cena', price: 35, isActive: true }
    ],
    skipDuplicates: true
  });

  await prisma.tourDestination.createMany({
    data: [
      { name: 'Ojo de Agua', description: 'Huertos hacia un manantial prístino.', pricePerPax: 65, isActive: true },
      { name: 'Río Molote', description: 'Entradas termales y refrescantes aguas.', pricePerPax: 85, isActive: true },
      { name: 'El Capomo', description: 'Piscina natural bajo una cascada.', pricePerPax: 75, isActive: true },
      { name: 'Las Cuevas', description: 'Playa secreta bajo un tapón volcánico.', pricePerPax: 55, isActive: true },
      { name: 'Jumurrca', description: 'Explora un balneario natural.', pricePerPax: 60, isActive: true },
      { name: 'Alta Vista', description: 'Antiguos petroglifos.', pricePerPax: 70, isActive: true },
      { name: 'Volcán', description: 'Vistas panorámicas al atardecer.', pricePerPax: 50, isActive: true }
    ],
    skipDuplicates: true
  });

  console.log("Datos insertados exitosamente!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
