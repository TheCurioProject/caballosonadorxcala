import { NextResponse } from "next/server";
import { z } from "zod";
import { body, failure } from "@/cala/infrastructure/http/server";
import { assertOrigin } from "@/cala/lib/runtime";
import { requireCalaAccess } from "@/lib/cala/access";
import { invariant } from "@/cala/domain/shared/errors";
import { grants } from "@/cala/domain/identity/permissions";
import type { Permission, Role } from "@/cala/domain/model";
import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Finanzas → Pagos web. Replaces the old website screens "Pagos de la web"
 * (Stripe balance + recent charges) and "Revisión de pagos" (paid website
 * bookings that hit an inventory conflict and were left as drafts).
 */
async function requirePermission(permission: Permission) {
  const access = await requireCalaAccess();
  const { data: role } = await access.client
    .from("roles")
    .select("key")
    .eq("id", access.member.role_id)
    .maybeSingle();
  const key = (role?.key ?? "viewer") as Role;
  invariant(
    (grants[key] ?? grants.viewer).includes(permission),
    "FORBIDDEN",
    "No tienes permiso para ver las finanzas.",
    403,
  );
  return access;
}

type Alert = {
  id: string;
  bookingId: number;
  guestName: string;
  start: string;
  end: string;
  createdAt: string;
};

async function openAlerts(): Promise<Alert[] | null> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        booking_id: number;
        guestName: string;
        start: string;
        end: string;
        created_at: Date;
      }>
    >`SELECT a.id,a.booking_id,b."guestName",b.start_date::date::text AS start,b.end_date::date::text AS end,a.created_at FROM site.integration_alerts a JOIN site.reservas b ON b.id=a.booking_id WHERE a.status='open' ORDER BY a.created_at DESC LIMIT 200`;
    return rows.map((r) => ({
      id: r.id,
      bookingId: Number(r.booking_id),
      guestName: r.guestName,
      start: r.start,
      end: r.end,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  } catch (error) {
    console.warn("finance/web: alerts unavailable", error);
    return null;
  }
}

async function stripeSummary() {
  if (!process.env.STRIPE_SECRET_KEY?.trim())
    return { configured: false as const };
  try {
    const [balance, charges] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.charges.list({ limit: 25 }),
    ]);
    return {
      configured: true as const,
      available: balance.available.map((b) => ({
        amount: b.amount,
        currency: b.currency,
      })),
      pending: balance.pending.map((b) => ({
        amount: b.amount,
        currency: b.currency,
      })),
      charges: charges.data.map((c) => ({
        id: c.id,
        amount: c.amount,
        amountRefunded: c.amount_refunded,
        currency: c.currency,
        status: c.status,
        created: c.created,
        description: c.description,
        receiptEmail: c.receipt_email ?? c.billing_details?.email ?? null,
        name: c.billing_details?.name ?? null,
      })),
    };
  } catch (error) {
    console.warn("finance/web: Stripe unavailable", error);
    return { configured: true as const, error: true as const };
  }
}

export async function GET() {
  try {
    await requirePermission("finance.read");
    const [alerts, stripeData] = await Promise.all([
      openAlerts(),
      stripeSummary(),
    ]);
    return NextResponse.json(
      { alerts, stripe: stripeData },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

/** Marks a payment-review alert as resolved once the stay has been sorted out. */
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await requirePermission("finance.write");
    const input = z
      .object({ action: z.literal("resolve"), id: z.uuid() })
      .parse(await body(request));
    await prisma.$executeRaw`UPDATE site.integration_alerts SET status='resolved' WHERE id=${input.id}::uuid`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
