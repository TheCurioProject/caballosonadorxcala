import prisma from "@/lib/prisma";
import { supabaseAdminClient } from "@/cala/infrastructure/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calendarIdentity } from "./ical-feed";

/**
 * The website's old iCal importer (site.ical_sources) is superseded when the
 * same OTA calendar is connected in CALA: remove it so dates are not imported
 * twice. Its blocks are replaced by the ones CALA just created. The same
 * calendar is recognised across country domains (airbnb.com / airbnb.mx).
 */
export async function retireLegacySource(url: string) {
  try {
    const identity = calendarIdentity(url);
    const sources = await prisma.icalSource.findMany({ select: { id: true, url: true } });
    for (const source of sources) {
      if (calendarIdentity(source.url) !== identity) continue;
      await prisma.$transaction([
        prisma.blockedDate.deleteMany({ where: { source: `ical-${source.id}` } }),
        prisma.icalSource.delete({ where: { id: source.id } }),
      ]);
    }
  } catch (error) {
    console.error("[connectors] legacy iCal source could not be retired", error);
  }
}

/**
 * Before the old importer runs: retire every legacy source whose calendar is
 * already connected in CALA. Two importers of one calendar would close the
 * same dates twice, with different rules.
 */
export async function retireLinkedLegacySources() {
  try {
    const admin = supabaseAdminClient() as unknown as SupabaseClient;
    const { data, error } = await admin.rpc("pms_service_calendar_links", { only_link: null });
    if (error) return;
    for (const link of (data ?? []) as { url: string }[]) await retireLegacySource(link.url);
  } catch {
    /* CALA connectors not configured: the legacy importer keeps working alone */
  }
  await removeOrphanLegacyBlocks();
}

/**
 * Blocks imported by a legacy source that no longer exists ("ical-<id>"):
 * nothing would ever update or release them, so they would close the website
 * forever. Manual closures and CALA blocks are never touched.
 */
export async function removeOrphanLegacyBlocks() {
  try {
    const sources = await prisma.icalSource.findMany({ select: { id: true } });
    const alive = new Set(sources.map((s) => `ical-${s.id}`));
    const imported = await prisma.blockedDate.findMany({ where: { source: { startsWith: "ical-" } }, select: { id: true, source: true } });
    const orphans = imported.filter((b) => b.source && /^ical-\d+$/.test(b.source) && !alive.has(b.source)).map((b) => b.id);
    if (orphans.length) await prisma.blockedDate.deleteMany({ where: { id: { in: orphans } } });
  } catch (error) {
    console.error("[connectors] orphan legacy blocks could not be removed", error);
  }
}
