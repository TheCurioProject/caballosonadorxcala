import prisma from '@/lib/prisma';
import { DEFAULT_IMAGES } from '@/lib/siteImages';

export async function getSiteImages() {
  let images: any[] = [];
  try {
    const fetchImages = prisma.siteImage.findMany();
    const timeout = new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Prisma timeout')), 8000));
    images = await Promise.race([fetchImages, timeout]);
  } catch (error) {
    console.warn("Failed to fetch site images from Prisma or timed out, using fallback defaults.");
  }
  
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
  try {
    const fetchImage = prisma.siteImage.findUnique({ where: { key } });
    const timeout = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Prisma timeout')), 8000));
    const image = await Promise.race([fetchImage, timeout]);
    if (image) return image.url;
  } catch (error) {
    console.warn(`Failed to fetch site image ${key} from Prisma, using fallback default.`);
  }
  
  const defaultImage = DEFAULT_IMAGES[key];
  return defaultImage ? defaultImage.url : '';
}
