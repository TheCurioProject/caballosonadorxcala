'use server';

import { revalidatePublicSite } from '@/lib/revalidatePublic';
import { requireAdmin } from '@/lib/auth';

import prisma from '@/lib/prisma';
import { autoTranslate } from '@/lib/translate';
import { revalidatePath } from 'next/cache';

// Initialize default food services if they don't exist
export async function initFoodServices() {
  await requireAdmin();
  const defaultServices = [
    { name: 'Breakfast', description: '8:00 AM - 10:00 AM', price: 25, type: 'FOOD' },
    { name: 'Breakfast & Lunch', description: '8:00 AM - 2:00 PM', price: 45, type: 'FOOD' },
    { name: 'Dinner', description: '5:00 PM - 7:00 PM', price: 35, type: 'FOOD' },
    { name: 'Dinner Service (6 to 8 people)', description: 'Dinner service for groups of 6 to 8 people', price: 3200, type: 'FOOD_PRICE' },
    { name: 'Dinner Service (10 to 12 people)', description: 'Dinner service for groups of 10 to 12 people', price: 4200, type: 'FOOD_PRICE' }
  ];

  for (const s of defaultServices) {
    const exists = await prisma.servicePricing.findFirst({
      where: { name: s.name, serviceType: s.type }
    });
    if (!exists) {
      await prisma.servicePricing.create({
        data: {
          serviceType: s.type,
          name: s.name,
          description: s.description,
          price: s.price,
          isActive: true
        }
      });
    }
  }
}

/** Names saved by the Experiencias editor are bilingual JSON ({"en","es","original"}). */
function plainText(value: string | null | undefined) {
  const text = (value ?? '').trim();
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      return String(parsed.original || parsed.es || parsed.en || '');
    } catch { /* plain text that looks like JSON */ }
  }
  return value ?? '';
}

export async function getFoodServices() {
  await requireAdmin();
  const where = { serviceType: { in: ['FOOD_SERVICE', 'FOOD_PRICE', 'FOOD_DISH', 'FOOD'] } };
  // Defaults only for an empty catalog: seeding by name on every visit
  // re-created any default the team had renamed (duplicated services).
  if ((await prisma.servicePricing.count({ where })) === 0) await initFoodServices();
  const services = await prisma.servicePricing.findMany({ where, orderBy: { id: 'asc' } });
  return services.map((s) => ({ ...s, name: plainText(s.name), description: plainText(s.description) }));
}

export async function updateServiceDetails(id: number, price: number, name: string, description: string) {
  await requireAdmin();
  try {
    // Same format as the Experiencias editor: the website shows each
    // language ({"en","es","original"}), so the text is translated on save.
    const [translatedName, translatedDescription] = await Promise.all([autoTranslate(name), autoTranslate(description)]);
    await prisma.servicePricing.update({
      where: { id },
      data: {
        price,
        name: translatedName,
        description: translatedDescription,
      }
    });
    revalidatePath('/admin/servicios-comida');
    revalidatePublicSite();
    return { success: true };
  } catch (error) {
    console.error('Error updating price:', error);
    return { success: false, error: 'Failed to update price' };
  }
}


export async function getFoodBookings() {
  await requireAdmin();
  return await prisma.serviceBooking.findMany({
    where: { serviceType: 'FOOD' },
    orderBy: { createdAt: 'desc' }
  });
}
