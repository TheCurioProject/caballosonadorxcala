import prisma from '@/lib/prisma';
import { z } from 'zod';

/** One ATV tour as edited in CALA and shown on /tours and in the booking modal. */
export interface SiteTour {
  id: number;
  slug: string | null;
  title: { es: string; en: string };
  summary: { es: string; en: string };
  long: { es: string; en: string };
  duration: { es: string; en: string };
  capacity: { es: string; en: string };
  includes: { es: string[]; en: string[] };
  images: string[];
  pricePerPax: number;
  isActive: boolean;
  sortOrder: number;
  /**
   * Name/description as the booking modal, Stripe and invoices use them (raw
   * `name`/`description` columns). They equal the title once the tour has been
   * saved from CALA → ATV Tours; older rows may still carry another name.
   */
  bookingName: string;
  bookingDescription: string | null;
}

type Row = {
  id: number; name: string; description: string | null; price_per_pax: number; is_active: boolean;
  slug: string | null; title_es: string | null; title_en: string | null; summary_es: string | null; summary_en: string | null;
  long_es: string | null; long_en: string | null; duration_es: string | null; duration_en: string | null;
  capacity_es: string | null; capacity_en: string | null; includes_es: unknown; includes_en: unknown; images: unknown; sort_order: number;
};

/** Names saved by the old editor are either plain text or {"en","es","original"}. */
function legacyText(value: string | null | undefined, lang: 'es' | 'en') {
  const text = (value ?? '').trim();
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text) as Record<string, string>;
      return parsed[lang] || parsed.original || parsed.es || parsed.en || '';
    } catch { /* plain text */ }
  }
  return text;
}
const list = (value: unknown) => (Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []);

function toTour(r: Row): SiteTour {
  const pair = (es: string | null, en: string | null, legacy?: string | null) => ({
    es: es ?? legacyText(legacy, 'es'),
    en: en ?? es ?? legacyText(legacy, 'en'),
  });
  return {
    id: r.id,
    slug: r.slug,
    title: pair(r.title_es, r.title_en, r.name),
    summary: pair(r.summary_es, r.summary_en, r.description),
    long: pair(r.long_es, r.long_en),
    duration: pair(r.duration_es, r.duration_en),
    capacity: pair(r.capacity_es, r.capacity_en),
    includes: { es: list(r.includes_es), en: list(r.includes_en).length ? list(r.includes_en) : list(r.includes_es) },
    images: list(r.images),
    pricePerPax: Number(r.price_per_pax),
    isActive: r.is_active,
    sortOrder: r.sort_order,
    bookingName: r.name,
    bookingDescription: r.description,
  };
}

/** The tour columns come with migration 20261118000000_site_tours.sql. */
const missingSchema = (error: unknown) => /42703|42P01|does not exist|no existe/i.test(String((error as { meta?: { code?: string }; message?: string })?.meta?.code ?? '') + String((error as Error)?.message ?? ''));

/**
 * Tours in display order. Returns null when the database does not have the
 * tour content yet (migration pending): callers fall back to the static copy.
 */
export async function listTours(options: { activeOnly?: boolean } = {}): Promise<SiteTour[] | null> {
  if (process.env.DATA_BACKEND !== 'supabase') return null;
  try {
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT id, name, description, price_per_pax, is_active, slug, title_es, title_en, summary_es, summary_en,
             long_es, long_en, duration_es, duration_en, capacity_es, capacity_en, includes_es, includes_en, images, sort_order
      FROM site.tour_destinations
      WHERE ${options.activeOnly ? true : false} = false OR is_active
      ORDER BY sort_order, id`;
    return rows.map(toTour);
  } catch (error) {
    if (missingSchema(error)) return null;
    throw error;
  }
}

const text = (max: number) => z.string().trim().max(max);
const pair = (max: number) => z.object({ es: text(max), en: text(max) });
const lines = z.array(z.string().trim().min(1).max(200)).max(20);
export const tourInput = z.object({
  id: z.number().int().positive().optional(),
  title: pair(120),
  summary: pair(400),
  long: pair(4000),
  duration: pair(60),
  capacity: pair(160),
  includes: z.object({ es: lines, en: lines }),
  images: z.array(z.string().url().max(600).regex(/^https:\/\/res\.cloudinary\.com\//)).max(24),
  pricePerPax: z.number().min(0).max(1_000_000),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});
export type TourInput = z.infer<typeof tourInput>;

/** Creates or updates a tour. `name`/`description` stay in step for the booking modal and invoices. */
export async function saveTour(input: TourInput): Promise<number> {
  const name = JSON.stringify({ en: input.title.en, es: input.title.es, original: input.title.es });
  const description = input.summary.es || input.summary.en
    ? JSON.stringify({ en: input.summary.en, es: input.summary.es, original: input.summary.es })
    : null;
  const includesEs = JSON.stringify(input.includes.es), includesEn = JSON.stringify(input.includes.en), images = JSON.stringify(input.images);
  if (input.id) {
    const updated = await prisma.$queryRaw<Array<{ id: number }>>`
      UPDATE site.tour_destinations SET name=${name}, description=${description}, price_per_pax=${input.pricePerPax}, is_active=${input.isActive},
        title_es=${input.title.es}, title_en=${input.title.en}, summary_es=${input.summary.es}, summary_en=${input.summary.en},
        long_es=${input.long.es}, long_en=${input.long.en}, duration_es=${input.duration.es}, duration_en=${input.duration.en},
        capacity_es=${input.capacity.es}, capacity_en=${input.capacity.en}, includes_es=${includesEs}::jsonb, includes_en=${includesEn}::jsonb,
        images=${images}::jsonb, sort_order=coalesce(${input.sortOrder ?? null}::integer, sort_order), updated_at=now()
      WHERE id=${input.id} RETURNING id`;
    if (!updated[0]) throw new Error('TOUR_NOT_FOUND');
    return updated[0].id;
  }
  const created = await prisma.$queryRaw<Array<{ id: number }>>`
    INSERT INTO site.tour_destinations(name, description, price_per_pax, is_active, title_es, title_en, summary_es, summary_en, long_es, long_en,
      duration_es, duration_en, capacity_es, capacity_en, includes_es, includes_en, images, sort_order, updated_at)
    VALUES(${name}, ${description}, ${input.pricePerPax}, ${input.isActive}, ${input.title.es}, ${input.title.en}, ${input.summary.es}, ${input.summary.en},
      ${input.long.es}, ${input.long.en}, ${input.duration.es}, ${input.duration.en}, ${input.capacity.es}, ${input.capacity.en},
      ${includesEs}::jsonb, ${includesEn}::jsonb, ${images}::jsonb,
      coalesce(${input.sortOrder ?? null}::integer, (SELECT coalesce(max(sort_order), 0) + 1 FROM site.tour_destinations)), now())
    RETURNING id`;
  return created[0].id;
}

export async function deleteTour(id: number) {
  await prisma.$executeRaw`DELETE FROM site.tour_destinations WHERE id=${id}`;
}

/** Saves a new display order: ids first to last. */
export async function reorderTours(ids: number[]) {
  await prisma.$transaction(ids.map((id, index) => prisma.$executeRaw`UPDATE site.tour_destinations SET sort_order=${index + 1} WHERE id=${id}`));
}
