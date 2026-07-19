import { getSiteImages } from '@/lib/siteImages.server';
import ToursClient from './ToursClient';

export default async function ToursPage({ params }: { params: Promise<{ lang: 'es' | 'en' }> }) {
  const { lang } = await params;
  const siteImages = await getSiteImages();
  
  return <ToursClient lang={lang} siteImages={siteImages} />;
}
