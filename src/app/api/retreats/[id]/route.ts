import { NextResponse } from 'next/server';
import { calaConfiguration } from '@/lib/cala/config';
import { getLodgings } from '@/lib/lodgings.server';
import { getSiteImages } from '@/lib/siteImages.server';
import { getImageUrl } from '@/lib/siteImages';
import { listRetreats, retreatOffers } from '@/lib/retreats.server';
import { retreatNights, retreatRemaining } from '@/lib/retreats';

export const dynamic = 'force-dynamic';

/** What the booking form needs: places left, the rooms CALA has free for the retreat and their lodging price. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Retiro no encontrado.' }, { status: 404 });
  if (!calaConfiguration().ready) return NextResponse.json({ error: 'Las reservas están en preparación.' }, { status: 503 });
  try {
    const [retreats, offers, catalog, images] = await Promise.all([listRetreats({ activeOnly: true }), retreatOffers(), getLodgings(), getSiteImages()]);
    const retreat = retreats.find(r => r.id === id);
    if (!retreat) return NextResponse.json({ error: 'Retiro no encontrado.' }, { status: 404 });
    const offer = offers.find(o => o.id === id);
    const rooms = (offer?.rooms ?? []).flatMap(room => {
      const lodging = catalog.find(l => l.id === room.lodgingId);
      if (!lodging) return [];
      const { id: lodgingId, roomNumber, name, description, beds, bathrooms, amenities, photoKeys } = lodging;
      return [{
        id: lodgingId, roomNumber: roomNumber ?? null, name, description, beds, bathrooms, amenities,
        capacity: room.capacity, available: room.available && Boolean(offer?.onSale),
        // Lodging at CALA's rates for the retreat's nights (null before migration 20261127).
        lodgingMinor: room.lodgingMinor ?? null,
        images: photoKeys.map(key => getImageUrl(key, images)).filter(Boolean),
        sortOrder: lodging.sortOrder,
      }];
    }).sort((a, b) => (a.roomNumber ?? 99) - (b.roomNumber ?? 99) || a.sortOrder - b.sortOrder);
    return NextResponse.json({
      retreat: { id: retreat.id, title: retreat.title, startsOn: retreat.startsOn, endsOn: retreat.endsOn, priceMinor: retreat.priceMinor, nights: retreatNights(retreat.startsOn, retreat.endsOn) },
      onSale: Boolean(offer?.onSale),
      remaining: retreatRemaining(retreat, offer),
      rooms,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[Retreat offer]', error);
    return NextResponse.json({ error: 'No se pudo cargar el retiro. Inténtalo de nuevo.' }, { status: 503 });
  }
}
