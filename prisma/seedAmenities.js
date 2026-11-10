const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const esPath = path.join(__dirname, '../src/i18n/dictionaries/es.json');
  const enPath = path.join(__dirname, '../src/i18n/dictionaries/en.json');

  const esDict = JSON.parse(fs.readFileSync(esPath, 'utf8'));
  const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));

  const esItems = esDict.services.items;
  const enItems = enDict.services.items;

  for (let i = 0; i < esItems.length; i++) {
    const es = esItems[i];
    const en = enItems[i] || esItems[i]; // Fallback to ES if EN missing

    await prisma.stayAmenity.create({
      data: {
        titleEs: es.title,
        titleEn: en.title,
        shortEs: es.short,
        shortEn: en.short,
        descEs: es.desc,
        descEn: en.desc
      }
    });
  }

  console.log('Stay amenities seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
