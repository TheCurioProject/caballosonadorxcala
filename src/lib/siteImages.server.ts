import prisma from '@/lib/prisma';
import { DEFAULT_IMAGES } from '@/lib/siteImages';
import { unstable_cache } from 'next/cache';

const fetchSiteImagesRaw = unstable_cache(
  async () => {
    let images: any[] = [];
    try {
      const fetchImages = prisma.siteImage.findMany();
      // Reduced timeout to 4 seconds to fail fast if DB is slow
      const timeout = new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Prisma timeout')), 4000));
      images = await Promise.race([fetchImages, timeout]);
    } catch (error) {
      console.warn("Failed to fetch site images from Prisma or timed out, using fallback defaults.");
    }
    return images;
  },
  ['site-images-all'],
  { revalidate: 3600, tags: ['siteImages'] }
);

export async function getSiteImages() {
  const images = await fetchSiteImagesRaw();
  
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

const fetchSiteImageRaw = unstable_cache(
  async (key: string) => {
    try {
      const fetchImage = prisma.siteImage.findUnique({ where: { key } });
      const timeout = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Prisma timeout')), 4000));
      const image = await Promise.race([fetchImage, timeout]);
      if (image) return image.url;
    } catch (error) {
      console.warn(`Failed to fetch site image ${key} from Prisma, using fallback default.`);
    }
    return null;
  },
  ['site-image-single'],
  { revalidate: 3600, tags: ['siteImages'] }
);

export async function getSiteImage(key: string) {
  const cachedUrl = await fetchSiteImageRaw(key);
  if (cachedUrl) return cachedUrl;
  
  const defaultImage = DEFAULT_IMAGES[key];
  return defaultImage ? defaultImage.url : '';
}
