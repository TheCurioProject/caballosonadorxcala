import { revalidatePublicSite } from '@/lib/revalidatePublic';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';
import { autoTranslate } from '@/lib/translate';
import { getLodgings } from '@/lib/lodgings.server';
import { lodgingDisplayName } from '@/lib/lodgings';
import {
  listRetreatBookings, listRetreats, retreatErrorCode, retreatOffers, retreatsReady, saveRetreatSales, syncRetreat,
  type RetreatSyncReport,
} from '@/lib/retreats.server';

export const dynamic = 'force-dynamic';

// The editor writes one language; the other one is translated automatically.
const translated = async (text: string | null) => {
  if (!text) return { es: text, en: text };
  try {
    const parsed = JSON.parse(await autoTranslate(text));
    return { es: parsed.es || text, en: parsed.en || text };
  } catch {
    return { es: text, en: text };
  }
};

async function upload(file: File | null, prefix: string) {
  if (!file || file.size === 0) return null;
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ public_id: `hotelsonador/retreats/${prefix}_${Date.now()}`, resource_type: 'image' }, (error, value) =>
        error || !value ? reject(error) : resolve(value as { secure_url: string }))
      .end(buffer);
  });
  return result.secure_url;
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

/** Dates, stock and retreat price (lodging excluded): all empty (draft, not on sale) or all valid. */
function salesOf(form: FormData) {
  const startsOn = text(form, 'startsOn');
  const endsOn = text(form, 'endsOn');
  const stockText = text(form, 'stock');
  const priceText = text(form, 'price').replace(/[$,\s]/g, '');
  if (!startsOn && !endsOn && !stockText && !priceText) return { sales: { startsOn: null, endsOn: null, stock: null, priceMinor: null } };
  if (!isoDate.test(startsOn) || !isoDate.test(endsOn)) return { error: 'Elige la fecha de llegada y la de salida del retiro.' };
  const nights = (Date.parse(endsOn) - Date.parse(startsOn)) / 86400000;
  if (!(nights >= 1)) return { error: 'La fecha de salida debe ser posterior a la de llegada.' };
  if (nights > 120) return { error: 'Un retiro puede durar como máximo 120 noches.' };
  const stock = Number(stockText);
  if (!Number.isInteger(stock) || stock < 1 || stock > 200) return { error: 'Escribe el cupo: cuántas veces se puede vender el retiro (de 1 a 200).' };
  const price = Number(priceText);
  if (!Number.isFinite(price) || price <= 0 || price > 1e9) return { error: 'Escribe el precio del retiro por reserva en MXN, sin el hospedaje.' };
  return { sales: { startsOn, endsOn, stock, priceMinor: Math.round(price * 100) } };
}

function failure(error: unknown, fallback: string) {
  const code = retreatErrorCode(error);
  if (code === 'RETREAT_HAS_BOOKINGS')
    return NextResponse.json({ error: 'Este retiro ya tiene reservas para esas fechas. Para cambiar las fechas o eliminarlo, cancela antes sus reservas (botón «Reservas»).' }, { status: 409 });
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const [ready, retreats, lodgings] = await Promise.all([retreatsReady(), listRetreats(), getLodgings(true).catch(() => [])]);
    const [offers, bookings] = ready ? await Promise.all([retreatOffers(), listRetreatBookings()]) : [[], []];
    return NextResponse.json({
      ready,
      retreats,
      offers,
      bookings,
      rooms: lodgings.filter(l => l.kind === 'room').map(l => ({ id: l.id, name: lodgingDisplayName(l, 'es'), capacity: l.capacity })),
    });
  } catch (error) {
    console.error('Error fetching retreats:', error);
    return NextResponse.json({ error: 'No se pudieron cargar los retiros.' }, { status: 500 });
  }
}

async function save(request: Request, editing: boolean) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const form = await request.formData();
    const id = editing ? Number(text(form, 'id')) : null;
    const title = text(form, 'title');
    const summary = text(form, 'summary');
    const description = text(form, 'description');
    const instructorName = text(form, 'instructorName') || null;
    const instructorBio = text(form, 'instructorBio') || null;
    const isActive = text(form, 'isActive') === 'true';
    if (editing && (!Number.isSafeInteger(id) || id! <= 0)) return NextResponse.json({ error: 'Falta el retiro.' }, { status: 400 });
    if (!title || !description) return NextResponse.json({ error: 'Escribe el título y la descripción.' }, { status: 400 });
    const parsed = salesOf(form);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const ready = await retreatsReady();
    if (!ready && parsed.sales.startsOn) return NextResponse.json({ error: 'Las ventas de retiros aún no están activadas en la base de datos.' }, { status: 503 });

    const [t, s, d, bio] = await Promise.all([translated(title), translated(summary || null), translated(description), translated(instructorBio)]);
    const image = form.get('image') as File | null;
    const instructorImage = form.get('instructorImage') as File | null;
    const [imageUrl, instructorImageUrl] = await Promise.all([upload(image, 'retreat'), upload(instructorImage, 'instructor')]);

    const data = {
      titleEs: t.es ?? title, titleEn: t.en ?? title, summaryEs: s.es, summaryEn: s.en,
      descriptionEs: d.es ?? description, descriptionEn: d.en ?? description,
      isActive, instructorName, instructorBioEs: bio.es, instructorBioEn: bio.en,
      ...(text(form, 'removeImage') === 'true' ? { imageUrl: null } : imageUrl ? { imageUrl } : {}),
      ...(text(form, 'removeInstructorImage') === 'true' ? { instructorImageUrl: null } : instructorImageUrl ? { instructorImageUrl } : {}),
    };

    let report: RetreatSyncReport | null = null;
    const saved = await prisma.$transaction(async tx => {
      const row = editing
        ? await tx.writersWorkshop.update({ where: { id: id! }, data })
        : await tx.writersWorkshop.create({ data });
      if (ready) {
        await saveRetreatSales(row.id, parsed.sales, tx);
        report = await syncRetreat(row.id, tx);
      }
      return row;
    }, { timeout: 20000 });
    revalidatePublicSite();
    return NextResponse.json({ id: saved.id, report });
  } catch (error) {
    return failure(error, 'No se pudo guardar el retiro.');
  }
}

export const POST = (request: Request) => save(request, false);
export const PUT = (request: Request) => save(request, true);

export async function DELETE(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    await prisma.writersWorkshop.delete({ where: { id } });
    revalidatePublicSite();
    return NextResponse.json({ success: true });
  } catch (error) {
    return failure(error, 'No se pudo eliminar el retiro.');
  }
}
