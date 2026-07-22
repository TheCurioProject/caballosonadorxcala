import { DEFAULT_IMAGES, keyToCloudinaryUrl } from '@/lib/siteImages';
import prisma from '@/lib/prisma';

export async function getSiteImages() {
  const mergedImages: Record<string, { url: string; name: string; group: string }> = {};
  
  // Fetch image overrides from the database
  let dbImages: any[] = [];
  try {
    dbImages = await prisma.siteImage.findMany();
  } catch (error) {
    console.warn("Failed to fetch site images from database", error);
  }
  const dbMap = new Map(dbImages.map(img => [img.key, img]));

  Object.entries(DEFAULT_IMAGES).forEach(([key, val]) => {
    const dbImg = dbMap.get(key);
    // Cloudinary upload responses provide a unique URL (with version hash) 
    // which bypasses next/image's cache automatically.
    const baseUrl = dbImg?.url || val.url || keyToCloudinaryUrl(key);
    const finalUrl = dbImg ? (baseUrl.includes('?') ? `${baseUrl}&v=${dbImg.updatedAt.getTime()}` : `${baseUrl}?v=${dbImg.updatedAt.getTime()}`) : baseUrl;

    mergedImages[key] = {
      ...val,
      url: finalUrl,
    };
  });
  
  return mergedImages;
}

export async function getSiteImage(key: string) {
  try {
    const dbImg = await prisma.siteImage.findUnique({ where: { key } });
    if (dbImg) {
      return dbImg.url.includes('?') ? `${dbImg.url}&v=${dbImg.updatedAt.getTime()}` : `${dbImg.url}?v=${dbImg.updatedAt.getTime()}`;
    }
  } catch (error) {
    // ignore
  }
  
  const defaultImage = DEFAULT_IMAGES[key];
  if (defaultImage?.url) return defaultImage.url;
  return keyToCloudinaryUrl(key);
}
