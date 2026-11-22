import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { revalidatePublicSite } from '@/lib/revalidatePublic';
import { RETREAT_MAX_GUESTS } from '@/lib/retreats';
import { getLodgings } from '@/lib/lodgings.server';

export const dynamic = 'force-dynamic';

const LIVE = ['PENDING', 'PAID', 'CONFIRMED', 'PAYMENT_REVIEW'];

const edit = z.object({
  bookingId: z.number().int().positive(),
  guestName: z.string().trim().min(2).max(255),
  guestEmail: z.string().trim().max(255).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  guestPhone: z.string().trim().max(50).nullable(),
  guests: z.number().int().min(1).max(RETREAT_MAX_GUESTS),
  notes: z.string().max(4000).nullable(),
});

async function retreatBooking(bookingId: number) {
  const rows = await prisma.$queryRaw<Array<{ payment_status: string; lodging_id: string; notes: string | null }>>`
    SELECT b.payment_status,rb.lodging_id::text AS lodging_id,b.notes FROM site.retreat_bookings rb
    JOIN site.reservas b ON b.id=rb.booking_id WHERE rb.booking_id=${bookingId}::integer`;
  const row = rows[0];
  if (!row) return null;
  // Room capacity as CALA defines it (max occupancy of its inventory type).
  const lodging = (await getLodgings(true)).find(l => l.id === row.lodging_id);
  return { ...row, capacity: lodging?.capacity ?? RETREAT_MAX_GUESTS };
}

/** Edits the guest's details and party size; CALA's reservation follows automatically. */
export async function PATCH(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const parsed = edit.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Revisa el nombre, el correo y el número de personas (1 o 2).' }, { status: 400 });
    const input = parsed.data;
    const current = await retreatBooking(input.bookingId);
    if (!current) return NextResponse.json({ error: 'Esa reserva ya no existe. Recarga la lista.' }, { status: 404 });
    if (input.guests > current.capacity) return NextResponse.json({ error: `Esa habitación admite como máximo ${current.capacity} ${current.capacity === 1 ? 'persona' : 'personas'}.` }, { status: 400 });
    // The party size also lives in the notes CALA shows ("Huéspedes: 2 adultos").
    const notes = (input.notes ?? current.notes ?? '').replace(/Huéspedes: \d+ adultos?/, `Huéspedes: ${input.guests} adultos`);
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`UPDATE site.booking_lodging SET adults=${input.guests}::integer,children=0 WHERE booking_id=${input.bookingId}::integer`;
      await tx.$executeRaw`UPDATE site.retreat_bookings SET guests=${input.guests}::integer WHERE booking_id=${input.bookingId}::integer`;
      await tx.$executeRaw`UPDATE site.reservas SET "guestName"=${input.guestName},"guestEmail"=${input.guestEmail.toLowerCase()},"guestPhone"=${input.guestPhone || null},
        notes=${notes || null},updated_at=now() WHERE id=${input.bookingId}::integer`;
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    console.error('Error editing retreat booking:', error);
    return NextResponse.json({ error: 'No se pudo guardar la reserva. Revisa que la habitación siga libre en CALA.' }, { status: 500 });
  }
}

/** Cancels a place: CALA cancels the reservation and the room goes back to the retreat. */
export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const bookingId = Number(body?.bookingId);
    if (body?.action !== 'cancel' || !Number.isSafeInteger(bookingId) || bookingId <= 0) return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
    const current = await retreatBooking(bookingId);
    if (!current) return NextResponse.json({ error: 'Esa reserva ya no existe. Recarga la lista.' }, { status: 404 });
    if (!LIVE.includes(current.payment_status)) return NextResponse.json({ success: true });
    await prisma.$executeRaw`UPDATE site.reservas SET payment_status='CANCELLED',updated_at=now() WHERE id=${bookingId}::integer`;
    revalidatePublicSite();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    console.error('Error cancelling retreat booking:', error);
    return NextResponse.json({ error: 'No se pudo cancelar la reserva.' }, { status: 500 });
  }
}
