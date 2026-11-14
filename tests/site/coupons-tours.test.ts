import { beforeAll, afterAll, test, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

// The server libraries talk to Postgres through Prisma's tagged templates; here
// the same SQL runs against the real migrated schema in PGlite.
const state = vi.hoisted(() => ({
  db: null as unknown as PGlite,
  stripe: new Map<string, { id: string; valid: boolean; percent_off?: number; amount_off?: number }>(),
}));
vi.mock("@/lib/prisma", () => {
  const run = async (strings: TemplateStringsArray, values: unknown[]) => {
    const text = strings.reduce((sql, part, i) => sql + part + (i < values.length ? `$${i + 1}` : ""), "");
    return state.db.query(text, values);
  };
  const client = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => (await run(strings, values)).rows,
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => (await run(strings, values)).affectedRows ?? 0,
    $transaction: async (work: unknown) => (Array.isArray(work) ? Promise.all(work) : (work as (tx: unknown) => unknown)(client)),
  };
  return { default: client };
});
vi.mock("@/lib/stripe", () => ({
  stripe: {
    coupons: {
      create: async (params: { percent_off?: number; amount_off?: number }) => {
        const coupon = { id: "stripe_" + Math.random().toString(36).slice(2), valid: true, ...params };
        state.stripe.set(coupon.id, coupon);
        return coupon;
      },
      retrieve: async (id: string) => {
        const coupon = state.stripe.get(id);
        if (!coupon) throw new Error("No such coupon");
        return coupon;
      },
      del: async (id: string) => state.stripe.delete(id),
    },
  },
}));

import { CouponError, confirmRedemption, couponsReady, deleteCoupon, listCoupons, releaseRedemption, saveCoupon, stripeCouponFor, usableCoupon } from "@/lib/coupons.server";
import { discountFor } from "@/lib/coupons";
import { deleteTour, listTours, reorderTours, saveTour } from "@/lib/tours.server";

beforeAll(async () => {
  process.env.DATA_BACKEND = "supabase";
  state.db = new PGlite();
  await state.db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`,
  );
  for (const name of readdirSync("supabase/migrations").filter((n) => n.endsWith(".sql")).sort())
    await state.db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
}, 120000);
afterAll(async () => {
  await state.db.close();
});

const reason = async (work: Promise<unknown>) =>
  work.then(
    () => "OK",
    (e) => (e instanceof CouponError ? e.reason : String(e)),
  );

test("coupon discounts never exceed the order", () => {
  expect(discountFor({ type: "percent", value: 10 }, 123456)).toBe(12346);
  expect(discountFor({ type: "fixed", value: 500 }, 123456)).toBe(50000);
  expect(discountFor({ type: "fixed", value: 5000 }, 123456)).toBe(123456);
  expect(discountFor({ type: "percent", value: 10 }, 0)).toBe(0);
});

test("coupons are created, validated against their rules and mirrored in Stripe", async () => {
  expect(await couponsReady()).toBe(true);
  const coupon = await saveCoupon({ code: "VERANO10", type: "percent", value: 10, minTotal: 1000, isActive: true, maxRedemptions: 2 });
  expect(coupon).toMatchObject({ code: "VERANO10", type: "percent", value: 10, minTotal: 1000, used: 0, pending: 0, maxRedemptions: 2 });
  expect(await reason(saveCoupon({ code: "VERANO10", type: "fixed", value: 5, minTotal: 0, isActive: true }))).toBe("DUPLICATE_CODE");

  // The guest may type it in any case and with spaces.
  const ok = await usableCoupon(" verano10 ", 500000);
  expect(ok.discountMinor).toBe(50000);
  expect(await reason(usableCoupon("NOEXISTE", 500000))).toBe("INVALID");
  expect(await reason(usableCoupon("VERANO10", 50000))).toBe("MIN_TOTAL");

  // The Stripe coupon is created once and reused while Stripe still has it.
  const first = await stripeCouponFor(ok.coupon);
  const again = await stripeCouponFor((await listCoupons())[0]);
  expect(again).toBe(first);
  expect(state.stripe.get(first)).toMatchObject({ percent_off: 10 });
  state.stripe.delete(first); // removed from the Stripe dashboard
  const recreated = await stripeCouponFor((await listCoupons())[0]);
  expect(recreated).not.toBe(first);

  // Two open checkouts hold both uses; one expires and frees its use; the other is paid.
  for (const session of ["cs_a", "cs_b"])
    await state.db.query("insert into site.coupon_redemptions(coupon_id,code,session_id,discount_minor) values($1,'VERANO10',$2,50000)", [coupon.id, session]);
  expect(await reason(usableCoupon("VERANO10", 500000))).toBe("EXHAUSTED");
  await releaseRedemption("cs_a");
  await confirmRedemption("cs_b", 49999);
  await confirmRedemption("cs_b", 1); // webhook retries never change a paid use
  expect((await listCoupons())[0]).toMatchObject({ used: 1, pending: 0, discountedMinor: 49999 });
  expect((await usableCoupon("VERANO10", 500000)).discountMinor).toBe(50000);

  // Changing the discount gets a new Stripe coupon; pausing blocks it.
  const changed = await saveCoupon({ id: coupon.id, code: "VERANO10", type: "fixed", value: 300, minTotal: 0, isActive: true });
  expect(changed.stripeCouponId).toBeNull();
  expect(state.stripe.has(recreated)).toBe(false);
  expect((await usableCoupon("VERANO10", 100000)).discountMinor).toBe(30000);
  // Stripe cannot charge between $0 and $10 MXN; a fully covered order is fine.
  expect(await reason(usableCoupon("VERANO10", 30500))).toBe("TOO_SMALL");
  expect((await usableCoupon("VERANO10", 20000)).discountMinor).toBe(20000);
  await saveCoupon({ id: coupon.id, code: "VERANO10", type: "fixed", value: 300, minTotal: 0, isActive: false });
  expect(await reason(usableCoupon("VERANO10", 100000))).toBe("INACTIVE");

  // Validity window, in the hotel's calendar day.
  await saveCoupon({ code: "PASADO", type: "percent", value: 5, minTotal: 0, isActive: true, validUntil: "2020-01-01" });
  await saveCoupon({ code: "FUTURO", type: "percent", value: 5, minTotal: 0, isActive: true, validFrom: "2999-01-01" });
  expect(await reason(usableCoupon("PASADO", 100000))).toBe("EXPIRED");
  expect(await reason(usableCoupon("FUTURO", 100000))).toBe("NOT_STARTED");

  // Removing a coupon keeps the history of what was redeemed.
  await deleteCoupon(coupon.id);
  expect((await listCoupons()).map((c) => c.code).sort()).toEqual(["FUTURO", "PASADO"]);
  const history = await state.db.query<{ code: string; coupon_id: number | null }>("select code,coupon_id from site.coupon_redemptions where status='paid'");
  expect(history.rows).toEqual([{ code: "VERANO10", coupon_id: null }]);
});

test("ATV tours are created, edited, ordered and removed", async () => {
  expect(await listTours()).toEqual([]);
  // A destination saved by the old editor: only name, description and price.
  await state.db.query(
    `insert into site.tour_destinations(name,description,price_per_pax,updated_at) values('{"en":"Sunset","es":"Atardecer","original":"Sunset"}','Vistas',750,now())`,
  );
  const [legacy] = (await listTours())!;
  expect(legacy).toMatchObject({ title: { es: "Atardecer", en: "Sunset" }, summary: { es: "Vistas", en: "Vistas" }, images: [], pricePerPax: 750, isActive: true });

  const input = {
    title: { es: "Ojo de Agua", en: "Ojo de Agua" },
    summary: { es: "Manantial", en: "Spring" },
    long: { es: "Largo", en: "Long" },
    duration: { es: "3-4 hrs", en: "3-4 hrs" },
    capacity: { es: "5 pasajeros", en: "5 passengers" },
    includes: { es: ["Hielera", "Guía"], en: ["Cooler", "Guide"] },
    images: ["https://res.cloudinary.com/demo/image/upload/a.webp", "https://res.cloudinary.com/demo/image/upload/b.webp"],
    pricePerPax: 1000,
    isActive: true,
  };
  const id = await saveTour(input);
  let tours = (await listTours())!;
  expect(tours.map((t) => t.title.es)).toEqual(["Atardecer", "Ojo de Agua"]);
  const created = tours.find((t) => t.id === id)!;
  expect(created).toMatchObject({ includes: input.includes, images: input.images, sortOrder: 1 });
  // The booking modal and invoices read the same name.
  expect(JSON.parse(created.bookingName)).toMatchObject({ es: "Ojo de Agua", en: "Ojo de Agua" });

  await saveTour({ ...input, id, title: { es: "Ojo de Agua nuevo", en: "New Ojo" }, isActive: false, images: [input.images[1]] });
  await reorderTours([id, legacy.id]);
  tours = (await listTours())!;
  expect(tours.map((t) => [t.title.en, t.isActive, t.images.length])).toEqual([
    ["New Ojo", false, 1],
    ["Sunset", true, 0],
  ]);
  expect((await listTours({ activeOnly: true }))!.map((t) => t.id)).toEqual([legacy.id]);

  await deleteTour(id);
  expect((await listTours())!.map((t) => t.id)).toEqual([legacy.id]);
  await expect(saveTour({ ...input, id })).rejects.toThrow("TOUR_NOT_FOUND");
});
