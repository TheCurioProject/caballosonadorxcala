const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Migration script: Clean JSON translation values to plain text (Spanish preferred)
 * This converts entries like: {"en":"Dinner Service","es":"Servicio de Cena"}
 * To plain text: "Servicio de Cena"
 */
async function extractPlainText(str) {
  if (!str) return str;
  const trimmed = str.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.es || parsed.en) {
        return parsed.es || parsed.en; // Prefer Spanish
      }
    } catch (e) {}
  }
  return str; // Already plain text
}

async function main() {
  console.log('=== Migration: Clean JSON translation values to plain text ===\n');

  // 1. Clean ServicePricing table
  const services = await prisma.servicePricing.findMany();
  let updatedCount = 0;

  for (const service of services) {
    const cleanName = await extractPlainText(service.name);
    const cleanDesc = await extractPlainText(service.description);

    if (cleanName !== service.name || cleanDesc !== service.description) {
      console.log(`[ServicePricing #${service.id}]`);
      if (cleanName !== service.name) {
        console.log(`  name: "${service.name}" → "${cleanName}"`);
      }
      if (cleanDesc !== service.description) {
        console.log(`  desc: "${service.description}" → "${cleanDesc}"`);
      }

      await prisma.servicePricing.update({
        where: { id: service.id },
        data: {
          name: cleanName,
          description: cleanDesc
        }
      });
      updatedCount++;
    }
  }
  console.log(`\nServicePricing: ${updatedCount} of ${services.length} records cleaned.\n`);

  // 2. Clean TourDestination table
  const tours = await prisma.tourDestination.findMany();
  let tourUpdatedCount = 0;

  for (const tour of tours) {
    const cleanName = await extractPlainText(tour.name);
    const cleanDesc = await extractPlainText(tour.description);

    if (cleanName !== tour.name || cleanDesc !== tour.description) {
      console.log(`[TourDestination #${tour.id}]`);
      if (cleanName !== tour.name) {
        console.log(`  name: "${tour.name}" → "${cleanName}"`);
      }
      if (cleanDesc !== tour.description) {
        console.log(`  desc: "${tour.description}" → "${cleanDesc}"`);
      }

      await prisma.tourDestination.update({
        where: { id: tour.id },
        data: {
          name: cleanName,
          description: cleanDesc
        }
      });
      tourUpdatedCount++;
    }
  }
  console.log(`TourDestination: ${tourUpdatedCount} of ${tours.length} records cleaned.\n`);

  console.log('=== Migration complete ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
