import prisma from '@/lib/prisma';
import { DEFAULT_IMAGES } from '@/lib/siteImages';

export async function getSiteImages() {
  const images = await prisma.siteImage.findMany();
  
  const mergedImages = { ...DEFAULT_IMAGES };
  
  images.forEach(img => {
    if (mergedImages[img.key]) {
      mergedImages[img.key].url = img.url;
    }
  });
  
  return mergedImages;
}

export async function getSiteImage(key: string) {
  const image = await prisma.siteImage.findUnique({ where: { key } });
  if (image) return image.url;
  
  const defaultImage = DEFAULT_IMAGES[key];
  return defaultImage ? defaultImage.url : '';
}
