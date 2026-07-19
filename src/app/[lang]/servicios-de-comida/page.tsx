import { getSiteImages } from '@/lib/siteImages';
import ServiciosDeComidaClient from './ServiciosDeComidaClient';

export default async function ServiciosDeComidaPage() {
  const siteImages = await getSiteImages();
  
  return <ServiciosDeComidaClient siteImages={siteImages} />;
}
