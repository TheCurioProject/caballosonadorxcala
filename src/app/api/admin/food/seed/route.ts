import { revalidatePublicSite } from '@/lib/revalidatePublic';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST() {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Delete all old FOOD services
    await prisma.servicePricing.deleteMany({
      where: {
        serviceType: {
          in: ['FOOD', 'FOOD_SERVICE', 'FOOD_PRICE', 'FOOD_DISH']
        }
      }
    });

    // 2. Add new Services
    await prisma.servicePricing.create({
      data: { serviceType: 'FOOD_SERVICE', name: 'Servicio Personalizado', price: 0, description: 'Personalized service for your group' }
    });
    await prisma.servicePricing.create({
      data: { serviceType: 'FOOD_SERVICE', name: 'Servicio de Cena', price: 0, description: 'Dinner service for your group' }
    });

    // 3. Add Pricing
    await prisma.servicePricing.create({
      data: { serviceType: 'FOOD_PRICE', name: 'Catering Breakfast', price: 650, description: '' }
    });
    await prisma.servicePricing.create({
      data: { serviceType: 'FOOD_PRICE', name: 'Catering Dinner', price: 650, description: '' }
    });
    await prisma.servicePricing.create({
      data: { serviceType: 'FOOD_PRICE', name: 'Both', price: 1000, description: '' }
    });

    // 4. Add Dishes
    const dishes = [
      { name: 'Enchiladas rojas', description: 'Tortilla enrollada, rellena de pollo, bañadas de salsa roja sin picante, acompañadas de lechuga, crema, queso y cebolla.' },
      { name: 'Chiles rellenos', description: 'Chile poblano relleno de un guiso de camarón y queso gratinado, bañados de una salsa cremosa roja, acompañado con arroz rojo.' },
      { name: 'Filete en alcaparras', description: 'Filete a la plancha sobre una cama de puré de papa, bañado de una salsa con mantequilla y alcaparras.' },
      { name: 'Tacos de asada y adobada', description: 'Tortilla de maíz con carne, cilantro y cebolla. Se acompaña con variedad de salsas.' },
      { name: 'Spaguetti con camarones', description: 'Spaguetti con camarones en salsa Alfredo.' },
      { name: 'Filete empapelado', description: 'Filete sazonado con finas hierbas, envuelto en papel y acompañado de verduras salteadas y arroz.' },
    ];

    for (const dish of dishes) {
      await prisma.servicePricing.create({
        data: { serviceType: 'FOOD_DISH', name: dish.name, description: dish.description, price: 0 }
      });
    }

    revalidatePublicSite();
    return NextResponse.json({ success: true, message: 'Database seeded successfully.' });
  } catch (error: any) {
    console.error('Error seeding database:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
