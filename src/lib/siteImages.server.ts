import { DEFAULT_IMAGES, keyToCloudinaryUrl } from '@/lib/siteImages';

export async function getSiteImages() {
  const mergedImages: Record<string, { url: string; name: string; group: string }> = {};
  
  Object.entries(DEFAULT_IMAGES).forEach(([key, val]) => {
    mergedImages[key] = {
      ...val,
      // If DEFAULT_IMAGES has a Cloudinary URL, use it. Otherwise construct one.
      url: val.url || keyToCloudinaryUrl(key),
    };
  });
  
  return mergedImages;
}

export async function getSiteImage(key: string) {
  const defaultImage = DEFAULT_IMAGES[key];
  if (defaultImage?.url) return defaultImage.url;
  return keyToCloudinaryUrl(key);
}
