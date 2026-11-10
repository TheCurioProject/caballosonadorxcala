import { z } from "zod";

const bilingual = z.object({ es: z.string(), en: z.string() });
export const lodgingSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["whole_home", "room"]),
  slug: z.string(),
  name: bilingual,
  description: bilingual,
  beds: bilingual,
  policy: bilingual,
  bathrooms: z.number().int(),
  photoKeys: z.array(z.string()),
  amenities: z.array(z.string()),
  capacity: z.number().int().positive(),
  fromRateMinor: z.number().int().nonnegative().optional(),
  baseRateMinor: z.number().int().nonnegative(),
  currency: z.string(),
  minStay: z.number().int().positive(),
  maxStay: z.number().int().positive(),
  turnoverNights: z.number().int().nonnegative(),
  leadTimeDays: z.number().int().nonnegative(),
  openThrough: z.string().nullable(),
  published: z.boolean(),
  enabled: z.boolean(),
  sortOrder: z.number().int(),
  version: z.number().int(),
  checkInTime: z.string(),
  checkOutTime: z.string(),
});
export type Lodging = z.infer<typeof lodgingSchema>;
export const lodgingUpdateSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().positive(),
    name: bilingual.extend({
      es: z.string().trim().min(1).max(160),
      en: z.string().trim().max(160),
    }),
    description: bilingual.extend({
      es: z.string().max(20000),
      en: z.string().max(20000),
    }),
    beds: bilingual.extend({
      es: z.string().max(300),
      en: z.string().max(300),
    }),
    policy: bilingual.extend({
      es: z.string().max(10000),
      en: z.string().max(10000),
    }),
    capacity: z.number().int().min(1).max(100),
    baseRateMinor: z.number().int().min(0).max(100000000000),
    bathrooms: z.number().int().min(0).max(100),
    amenities: z.array(z.string().trim().min(1).max(120)).max(40),
    minStay: z.number().int().min(1).max(365),
    maxStay: z.number().int().min(1).max(366),
    turnoverNights: z.number().int().min(0).max(7),
    leadTimeDays: z.number().int().min(0).max(365),
    openThrough: z.iso.date().nullable(),
    published: z.boolean(),
    enabled: z.boolean(),
    checkInTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    checkOutTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
  })
  .refine((v) => v.maxStay >= v.minStay, {
    message: "La estancia máxima debe ser mayor o igual a la mínima.",
  });
export type LodgingUpdate = z.infer<typeof lodgingUpdateSchema>;
export type SalesClosure = {
  id: number;
  startDate: string;
  endDate: string;
  reason: string;
  updatedAt: string;
};
export const lodgingSelectionSchema = z.object({
  lodgingId: z.uuid(),
  adults: z.number().int().min(1).max(100),
  children: z.number().int().min(0).max(100),
});
export type LodgingSelection = z.infer<typeof lodgingSelectionSchema>;
export type LodgingAvailability = {
  reservations: Array<{ checkIn: string; checkOut: string }>;
  blocks: Array<{ startDate: string; endDate: string; buffer: boolean }>;
  salesClosures: Array<{ startDate: string; endDate: string }>;
  pricingRules: Array<{
    date: string;
    priceOverride: number;
    closed: boolean;
    minStay: number;
    /** Added by 20261112000000_public_rate_restrictions; absent before it. */
    maxStay?: number;
    cta?: boolean;
    ctd?: boolean;
  }>;
  basePrice: number;
  today: string;
  openThrough: string | null;
  turnoverNights: number;
  minStay: number;
  maxStay: number;
  leadTimeDays: number;
  checkInTime: string;
  checkOutTime: string;
};

export function lodgingText(value: { es: string; en: string }, lang: string) {
  return lang === "en" ? value.en || value.es : value.es;
}
export function lodgingPrice(
  amountMinor: number,
  currency = "MXN",
  lang = "es",
) {
  return (
    new Intl.NumberFormat(lang === "en" ? "en-US" : "es-MX", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100) +
    " " +
    currency
  );
}
