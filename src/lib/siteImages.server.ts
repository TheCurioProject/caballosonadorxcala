import prisma from '@/lib/prisma';
import { DEFAULT_IMAGES } from '@/lib/siteImages';

export async function getSiteImages() {
  const images = await prisma.siteImage.findMany();
  
  const mergedImages: Record<string, { url: string; name: string; group: string }> = {};
  
  Object.entries(DEFAULT_IMAGES).forEach(([key, val]) => {
    mergedImages[key] = { ...val };
  });
  
  images.forEach(img => {
    if (mergedImages[img.key]) {
      mergedImages[img.key].url = img.url;
    } else {
      mergedImages[img.key] = {
        url: img.url,
        name: img.name || img.key,
        group: img.group || 'OTHER'
      };
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
