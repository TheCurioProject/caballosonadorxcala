import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const DEFAULT_IMAGES = {
  // HOMEPAGE
  'home.hero': {
    url: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/casaexterior.webp`,
    name: 'Imagen Principal (Hero)',
    group: 'HOMEPAGE'
  },
  'home.about': {
    url: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/casaestancia.webp`,
    name: 'Sección About',
    group: 'HOMEPAGE'
  },
  'home.concept': {
    url: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/casapaisaje.webp`,
    name: 'Sección Concepto',
    group: 'HOMEPAGE'
  },
  'home.services': {
    url: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/casacuartos.webp`,
    name: 'Sección Servicios',
    group: 'HOMEPAGE'
  },
  // COMIDA
  'food.hero': {
    url: '/DSC_0226.webp',
    name: 'Imagen Principal Comida',
    group: 'FOOD'
  },
  'food.kitchen': {
    url: '/imagenes/05_amenities/amenity_05_guest_kitchen.webp',
    name: 'Cocina',
    group: 'FOOD'
  },
  'food.pool': {
    url: '/imagenes/05_amenities/amenity_02_pool_lounge.webp',
    name: 'Alberca / Lounge',
    group: 'FOOD'
  },
  'food.sunset': {
    url: '/tours_gallery/07_volcano/00_sunset_019.webp',
    name: 'Atardecer (Sunset)',
    group: 'FOOD'
  },
  // TOURS (Representantes para demostración, se podría expandir)
  'tours.hero': {
    url: '/tours_gallery/01_ojo_de_agua/00_ojoagua_002.webp',
    name: 'Imagen Principal Tours (Ojo de Agua)',
    group: 'TOURS'
  }
};

export async function getSiteImages() {
  const images = await prisma.siteImage.findMany();
  
  // Combina las imágenes de la base de datos con las por defecto
  const mergedImages = { ...DEFAULT_IMAGES };
  
  images.forEach(img => {
    if (mergedImages[img.key as keyof typeof DEFAULT_IMAGES]) {
      mergedImages[img.key as keyof typeof DEFAULT_IMAGES].url = img.url;
    }
  });
  
  return mergedImages;
}

export async function getSiteImage(key: string) {
  const image = await prisma.siteImage.findUnique({ where: { key } });
  if (image) return image.url;
  
  const defaultImage = DEFAULT_IMAGES[key as keyof typeof DEFAULT_IMAGES];
  return defaultImage ? defaultImage.url : '';
}
