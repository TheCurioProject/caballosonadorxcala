import { requireAdminPage } from "@/lib/auth";
import { getLodgings } from "@/lib/lodgings.server";
import { getSiteImages } from "@/lib/siteImages.server";
import prisma from "@/lib/prisma";
import type { SalesClosure } from "@/lib/lodgings";
import LodgingsEditor from "./LodgingsEditor";
export const dynamic = "force-dynamic";
export default async function LodgingsPage() {
  await requireAdminPage();
  const [lodgings, images] = await Promise.all([
    getLodgings(true),
    getSiteImages(),
  ]);
  const whole = lodgings.find((l) => l.kind === "whole_home");
  const closures = whole
    ? await prisma.$queryRaw<
        Array<SalesClosure>
      >`SELECT b.id,b.start_date::date::text AS "startDate",b.end_date::date::text AS "endDate",coalesce(b.reason,'Cierre de venta') AS reason,to_char(b.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt" FROM site.blocked_dates b JOIN site.legacy_block_scopes sc ON sc.block_id=b.id JOIN site.lodgings l ON l.site_property_id=b.property_id WHERE l.id=${whole.id}::uuid ORDER BY b.start_date DESC,b.id`
    : [];
  return (
    <LodgingsEditor lodgings={lodgings} images={images} closures={closures} />
  );
}
