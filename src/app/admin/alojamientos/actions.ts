"use server";
import { revalidatePublicSite } from "@/lib/revalidatePublic";
import { requireAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { lodgingUpdateSchema } from "@/lib/lodgings";
import { getLodgings } from "@/lib/lodgings.server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

function invalidate() {
  for (const path of [
    "/admin/alojamientos",
    "/es",
    "/en",
    "/es/rooms",
    "/en/rooms",
    "/es/politicas",
    "/en/politicas",
  ])
    revalidatePath(path);
  revalidatePublicSite();
}
function failure(error: unknown) {
  const value = error as { message?: string; meta?: { message?: string } };
  const message = String(value.meta?.message || value.message || "");
  if (/VERSION_CONFLICT/.test(message))
    return {
      ok: false as const,
      message:
        "Otra persona modificó esta información. Actualiza la página antes de guardar.",
    };
  if (/OCCUPANCY_CONFLICT/.test(message))
    return {
      ok: false as const,
      message: "La capacidad propuesta es menor que la de una reserva vigente.",
    };
  return {
    ok: false as const,
    message: "No se pudo guardar. Revisa los campos, tu sesión y la conexión.",
  };
}
export async function saveLodging(input: unknown) {
  try {
    const session = await requireAdmin();
    const parsed = lodgingUpdateSchema.parse(input);
    // Capacity, base rate and check-in/out times belong to CALA (Inventario,
    // Tarifas, Configuración). site.save_lodging still writes them, so always
    // send the values CALA holds right now: this form can never revert them.
    const current = (await getLodgings(true)).find((l) => l.id === parsed.id);
    if (!current) throw new Error("NOT_FOUND");
    const { checkInTime: _in, checkOutTime: _out, ...value } = {
      ...parsed,
      capacity: current.capacity,
      baseRateMinor: current.baseRateMinor,
    };
    void _in;
    void _out;
    await prisma.$queryRaw`SELECT site.save_lodging(${value.id}::uuid,${value.version}::bigint,${JSON.stringify({ ...value, actorId: session.authUserId })}::jsonb,${process.env.CALA_ORGANIZATION_ID}::uuid)`;
    invalidate();
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}
const closureSchema = z
  .object({
    lodgingId: z.uuid(),
    id: z.number().int().positive().optional(),
    updatedAt: z.string().optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    reason: z.string().trim().max(500).optional(),
    remove: z.boolean().optional(),
  })
  .refine((v) =>
    v.remove
      ? Boolean(v.id && v.updatedAt)
      : Boolean(v.startDate && v.endDate && v.endDate >= v.startDate),
  );
export async function saveSalesClosure(input: unknown) {
  try {
    const session = await requireAdmin();
    const value = closureSchema.parse(input);
    await prisma.$queryRaw`SELECT site.save_sales_closure(${JSON.stringify({ ...value, actorId: session.authUserId })}::jsonb,${process.env.CALA_ORGANIZATION_ID}::uuid)`;
    invalidate();
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}
