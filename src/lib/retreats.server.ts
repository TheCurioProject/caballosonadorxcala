import prisma from "@/lib/prisma";
import { databaseRead } from "@/lib/database-read";
import { retreatErrorCodes, type Retreat, type RetreatOffer } from "@/lib/retreats";

type Db = Pick<typeof prisma, "$queryRaw" | "$executeRaw">;
type Row = {
  id: number;
  title_es: string; title_en: string;
  summary_es: string | null; summary_en: string | null;
  description_es: string; description_en: string;
  image_url: string | null;
  instructor_name: string | null;
  instructor_bio_es: string | null; instructor_bio_en: string | null;
  instructor_image_url: string | null;
  is_active: boolean;
  starts_on?: string | null; ends_on?: string | null;
  stock?: number | null; price_minor?: bigint | number | null;
};

const organization = () => process.env.CALA_ORGANIZATION_ID;

/** Columns arrive with migration 20261126000000_site_retreats.sql. */
export const retreatSchemaMissing = (error: unknown) =>
  /42703|42P01|42883|does not exist|no existe/i.test(
    String((error as { meta?: { code?: string } })?.meta?.code ?? "") + String((error as Error)?.message ?? ""),
  );

function toRetreat(r: Row): Retreat {
  const pair = (es: string | null, en: string | null) => ({ es: es ?? "", en: en || es || "" });
  return {
    id: r.id,
    title: pair(r.title_es, r.title_en),
    summary: pair(r.summary_es, r.summary_en),
    description: pair(r.description_es, r.description_en),
    imageUrl: r.image_url,
    instructorName: r.instructor_name,
    instructorBio: pair(r.instructor_bio_es, r.instructor_bio_en),
    instructorImageUrl: r.instructor_image_url,
    startsOn: r.starts_on ?? null,
    endsOn: r.ends_on ?? null,
    stock: r.stock ?? null,
    priceMinor: r.price_minor == null ? null : Number(r.price_minor),
    isActive: r.is_active,
  };
}

/** Retreats, the next ones first. Without the migration the sales fields are empty. */
export async function listRetreats(options: { activeOnly?: boolean } = {}): Promise<Retreat[]> {
  if (process.env.DATA_BACKEND !== "supabase") return [];
  const active = Boolean(options.activeOnly);
  try {
    const rows = await databaseRead(() => prisma.$queryRaw<Row[]>`
      SELECT id,title_es,title_en,summary_es,summary_en,description_es,description_en,image_url,instructor_name,
             instructor_bio_es,instructor_bio_en,instructor_image_url,is_active,
             starts_on::text AS starts_on,ends_on::text AS ends_on,stock,price_minor
      FROM site.writers_workshops WHERE (NOT ${active}::boolean OR is_active)
      ORDER BY starts_on NULLS LAST,created_at DESC`);
    return rows.map(toRetreat);
  } catch (error) {
    if (!retreatSchemaMissing(error)) throw error;
    const rows = await databaseRead(() => prisma.$queryRaw<Row[]>`
      SELECT id,title_es,title_en,summary_es,summary_en,description_es,description_en,image_url,instructor_name,
             instructor_bio_es,instructor_bio_en,instructor_image_url,is_active
      FROM site.writers_workshops WHERE (NOT ${active}::boolean OR is_active) ORDER BY created_at DESC`);
    return rows.map(toRetreat);
  }
}

export async function retreatsReady() {
  if (process.env.DATA_BACKEND !== "supabase") return false;
  const rows = await databaseRead(() =>
    prisma.$queryRaw<Array<{ ok: boolean }>>`SELECT to_regprocedure('site.retreat_hold(integer,uuid,integer,jsonb,uuid)') IS NOT NULL AS ok`,
  );
  return Boolean(rows[0]?.ok);
}

/** Places sold and free rooms of every retreat (empty before the migration). */
export async function retreatOffers(): Promise<RetreatOffer[]> {
  if (process.env.DATA_BACKEND !== "supabase" || !organization()) return [];
  try {
    const rows = await databaseRead(() =>
      prisma.$queryRaw<Array<{ data: RetreatOffer[] }>>`SELECT site.retreat_offers(${organization()}::uuid) AS data`,
    );
    return rows[0]?.data ?? [];
  } catch (error) {
    if (retreatSchemaMissing(error)) return [];
    throw error;
  }
}

export type RetreatSyncReport = { onSale: boolean; rooms: Array<{ lodgingId: string; state: "open" | "sold" | "busy" | "off" }> };

/** Blocks (or frees) the house in CALA for the retreat's dates. */
export async function syncRetreat(id: number, db: Db = prisma): Promise<RetreatSyncReport> {
  const rows = await db.$queryRaw<Array<{ data: RetreatSyncReport }>>`SELECT site.retreat_sync(${id}::integer,${organization()}::uuid) AS data`;
  return rows[0].data;
}

export async function saveRetreatSales(
  id: number,
  sales: { startsOn: string | null; endsOn: string | null; stock: number | null; priceMinor: number | null },
  db: Db = prisma,
) {
  await db.$executeRaw`UPDATE site.writers_workshops SET starts_on=${sales.startsOn}::date,ends_on=${sales.endsOn}::date,
    stock=${sales.stock}::integer,price_minor=${sales.priceMinor === null ? null : BigInt(sales.priceMinor)}::bigint WHERE id=${id}::integer`;
}

/** Takes one place (inside the checkout transaction); returns the website booking id. */
export async function holdRetreat(
  db: Db,
  input: { retreatId: number; lodgingId: string; guests: number; name: string; email: string; phone: string; lang: string },
) {
  const guest = JSON.stringify({ name: input.name, email: input.email, phone: input.phone, lang: input.lang });
  const rows = await db.$queryRaw<Array<{ id: number }>>`SELECT site.retreat_hold(${input.retreatId}::integer,${input.lodgingId}::uuid,${input.guests}::integer,${guest}::jsonb,${organization()}::uuid) AS id`;
  return Number(rows[0].id);
}

/** Total (cents) site.retreat_hold put on the booking: retreat + room at CALA's rates. */
export async function heldTotalMinor(db: Db, bookingId: number) {
  const rows = await db.$queryRaw<Array<{ total: bigint | number }>>`SELECT round("totalPrice"*100)::bigint AS total FROM site.reservas WHERE id=${bookingId}::integer`;
  return Number(rows[0]?.total ?? 0);
}

/** The RETREAT_* code a database error carries, if any. */
export function retreatErrorCode(error: unknown) {
  const e = error as { meta?: { message?: string }; message?: string } | null;
  const text = `${e?.meta?.message ?? ""} ${e?.message ?? ""}`;
  return retreatErrorCodes.find((c) => text.includes(c)) ?? (/RETREAT_HAS_BOOKINGS/.test(text) ? "RETREAT_HAS_BOOKINGS" : null);
}

export interface RetreatBooking {
  bookingId: number;
  retreatId: number;
  lodgingId: string;
  guests: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  status: string;
  totalPrice: number;
  paid: number;
  notes: string | null;
  createdAt: string;
}

export async function listRetreatBookings(retreatId?: number): Promise<RetreatBooking[]> {
  const rows = await databaseRead(() => prisma.$queryRaw<Array<{
    booking_id: number; retreat_id: number; lodging_id: string; guests: number; guest_name: string; guest_email: string;
    guest_phone: string | null; payment_status: string; total_price: number; deposit_paid: number | null; notes: string | null; created_at: Date;
  }>>`
    SELECT rb.booking_id,rb.retreat_id,rb.lodging_id::text AS lodging_id,rb.guests,b."guestName" AS guest_name,b."guestEmail" AS guest_email,
           b."guestPhone" AS guest_phone,b.payment_status,b."totalPrice" AS total_price,b.deposit_paid,b.notes,b.created_at
    FROM site.retreat_bookings rb JOIN site.reservas b ON b.id=rb.booking_id
    WHERE (${retreatId ?? null}::integer IS NULL OR rb.retreat_id=${retreatId ?? null}::integer)
    ORDER BY b.created_at DESC`);
  return rows.map((r) => ({
    bookingId: r.booking_id,
    retreatId: r.retreat_id,
    lodgingId: r.lodging_id,
    guests: r.guests,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    guestPhone: r.guest_phone,
    status: r.payment_status,
    totalPrice: Number(r.total_price),
    paid: Number(r.deposit_paid ?? 0),
    notes: r.notes,
    createdAt: r.created_at.toISOString(),
  }));
}
