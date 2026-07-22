import { getSiteImages } from '@/lib/siteImages.server';

export const revalidate = 60;
import RoomsClient from './RoomsClient';

export default async function RoomsPage() {
  const siteImages = await getSiteImages();
  return <RoomsClient siteImages={siteImages} />;
}
