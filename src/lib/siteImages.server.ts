import prisma from '@/lib/prisma';
import { DEFAULT_IMAGES } from '@/lib/siteImages';

const fetchSiteImagesRaw = async () => {
  try {
    return await prisma.siteImage.findMany();
  } catch (error) {
    console.error("Failed to fetch site images from Prisma:", error);
    throw error;
  }
};

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

const fetchSiteImageRaw = async (key: string) => {
  try {
    const image = await prisma.siteImage.findUnique({ where: { key } });
    return image ? image.url : null;
  } catch (error) {
    console.error(`Failed to fetch site image ${key} from Prisma:`, error);
    throw error;
  }
};

export async function getSiteImage(key: string) {
  const cachedUrl = await fetchSiteImageRaw(key);
  if (cachedUrl) return cachedUrl;
  
  const defaultImage = DEFAULT_IMAGES[key];
  return defaultImage ? defaultImage.url : '';
}
