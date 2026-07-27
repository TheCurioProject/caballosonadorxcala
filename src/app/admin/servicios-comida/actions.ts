'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getTranslations } from '@/lib/translate';

// Initialize default food services if they don't exist
export async function initFoodServices() {
  const defaultServices = [
    { name: 'Desayuno', description: '8:00 AM - 10:00 AM', price: 25 },
    { name: 'Desayuno y Comida', description: '8:00 AM - 2:00 PM', price: 45 },
    { name: 'Cena', description: '5:00 PM - 7:00 PM', price: 35 }
  ];

  for (const s of defaultServices) {
    const exists = await prisma.servicePricing.findFirst({
      where: { name: s.name, serviceType: 'FOOD' }
    });
    if (!exists) {
      await prisma.servicePricing.create({
        data: {
          serviceType: 'FOOD',
          name: s.name,
          description: s.description,
          price: s.price,
          isActive: true
        }
      });
    }
  }
}

export async function getFoodServices() {
  await initFoodServices(); // Ensure defaults exist
  return await prisma.servicePricing.findMany({
    where: { serviceType: 'FOOD' },
    orderBy: { id: 'asc' }
  });
}

export async function updateServiceDetails(id: number, price: number, name: string, description: string) {
  try {
    const nameJson = JSON.stringify(await getTranslations(name));
    const descJson = JSON.stringify(await getTranslations(description));

    await prisma.servicePricing.update({
      where: { id },
      data: { 
        price,
        name: nameJson,
        description: descJson
      }
    });
    revalidatePath('/admin/servicios-comida');
    revalidatePath('/[lang]/servicios-de-comida', 'page');
    return { success: true };
  } catch (error) {
    console.error('Error updating price:', error);
    return { success: false, error: 'Failed to update price' };
  }
}

export async function getFoodBookings() {
  return await prisma.serviceBooking.findMany({
    where: { serviceType: 'FOOD' },
    orderBy: { createdAt: 'desc' }
  });
}
