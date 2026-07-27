const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getTranslations(text) {
  if (!text || text.trim() === '') return { en: '', es: '' };
  try {
    const urlEn = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const resEn = await fetch(urlEn);
    const dataEn = await resEn.json();
    const detectedLang = dataEn[2] || 'es';
    const translatedToEn = dataEn[0].map(item => item[0]).join('');

    if (detectedLang === 'en') {
      const urlEs = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(text)}`;
      const resEs = await fetch(urlEs);
      const dataEs = await resEs.json();
      const translatedToEs = dataEs[0].map(item => item[0]).join('');
      return { en: text, es: translatedToEs };
    } else {
      return { en: translatedToEn, es: text };
    }
  } catch (error) {
    return { en: text, es: text };
  }
}

async function main() {
  console.log("Migrating ServicePricing...");
  const services = await prisma.servicePricing.findMany();
  for (const s of services) {
    if (s.name && !s.name.startsWith('{')) {
      const nameJson = JSON.stringify(await getTranslations(s.name));
      let descJson = s.description;
      if (s.description && !s.description.startsWith('{')) {
        descJson = JSON.stringify(await getTranslations(s.description));
      }
      await prisma.servicePricing.update({
        where: { id: s.id },
        data: { name: nameJson, description: descJson }
      });
      console.log(`Updated ServicePricing ${s.id}: ${nameJson}`);
    }
  }

  console.log("Migrating TourDestinations...");
  const tours = await prisma.tourDestination.findMany();
  for (const t of tours) {
    if (t.name && !t.name.startsWith('{')) {
      const nameJson = JSON.stringify(await getTranslations(t.name));
      await prisma.tourDestination.update({
        where: { id: t.id },
        data: { name: nameJson }
      });
      console.log(`Updated TourDestination ${t.id}: ${nameJson}`);
    }
  }
  console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
