import { getSiteImages } from '@/lib/siteImages.server';
import EventsClient from './EventsClient';

export default async function EventsPage() {
  const siteImages = await getSiteImages();
  return <EventsClient siteImages={siteImages} />;
}
