import { revalidatePublicSite } from '@/lib/revalidatePublic';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { autoTranslate } from '@/lib/translate';
import { deleteTour, listTours, reorderTours, saveTour, tourInput } from '@/lib/tours.server';

export const dynamic = 'force-dynamic';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const pending = () => NextResponse.json({ error: 'La sección de tours aún no está activada en la base de datos.', code: 'TOURS_PENDING' }, { status: 503 });

/** Fills the missing language of a pair with an automatic translation. */
async function completePair(value: { es: string; en: string }) {
  if (value.es && value.en) return value;
  const source = value.es || value.en;
  if (!source) return value;
  try {
    const parsed = JSON.parse(await autoTranslate(source)) as { es?: string; en?: string };
    return { es: value.es || parsed.es || source, en: value.en || parsed.en || source };
  } catch {
    return { es: value.es || source, en: value.en || source };
  }
}
async function completeLines(value: { es: string[]; en: string[] }) {
  if (value.es.length && value.en.length) return value;
  const source = value.es.length ? value.es : value.en;
  const translated = await Promise.all(source.map(line => completePair(value.es.length ? { es: line, en: '' } : { es: '', en: line })));
  return { es: translated.map(t => t.es), en: translated.map(t => t.en) };
}

export async function GET() {
  if (!(await getSession())) return unauthorized();
  try {
    const tours = await listTours();
    if (!tours) return pending();
    return NextResponse.json(tours);
  } catch (error) {
    console.error('Error fetching tours:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await getSession())) return unauthorized();
  try {
    const parsed = tourInput.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Revisa los datos del tour.', issues: parsed.error.issues.map(i => i.path.join('.')) }, { status: 400 });
    const input = parsed.data;
    if (!input.title.es && !input.title.en) return NextResponse.json({ error: 'Escribe el nombre del tour.' }, { status: 400 });
    if (!(await listTours())) return pending();
    const [title, summary, long, duration, capacity, includes] = await Promise.all([
      completePair(input.title), completePair(input.summary), completePair(input.long),
      completePair(input.duration), completePair(input.capacity), completeLines(input.includes),
    ]);
    const id = await saveTour({ ...input, title, summary, long, duration, capacity, includes });
    revalidatePublicSite();
    const saved = (await listTours())?.find(t => t.id === id);
    return NextResponse.json(saved ?? { id });
  } catch (error) {
    if ((error as Error).message === 'TOUR_NOT_FOUND') return NextResponse.json({ error: 'Ese tour ya no existe. Recarga la lista.' }, { status: 404 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    console.error('Error saving tour:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/** Saves the display order: { ids: [first, …, last] }. */
export async function PATCH(req: Request) {
  if (!(await getSession())) return unauthorized();
  try {
    const parsed = z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Orden inválido' }, { status: 400 });
    await reorderTours(parsed.data.ids);
    revalidatePublicSite();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering tours:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await getSession())) return unauthorized();
  try {
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    await deleteTour(id);
    revalidatePublicSite();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tour:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
