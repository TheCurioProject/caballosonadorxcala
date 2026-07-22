import { getSiteImages } from '@/lib/siteImages.server';

export const revalidate = 60;
import ServiciosDeComidaClient from './ServiciosDeComidaClient';

export default async function ServiciosDeComidaPage() {
  const siteImages = await getSiteImages();
  
  return <ServiciosDeComidaClient siteImages={siteImages} />;
}
