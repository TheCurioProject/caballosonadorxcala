import prisma from "@/lib/prisma";

/**
 * The website's old iCal importer (site.ical_sources) is superseded when the
 * same OTA calendar is connected in CALA: remove it so dates are not imported
 * twice. Its blocks are replaced by the ones CALA just created.
 */
export async function retireLegacySource(url: string) {
  try {
    const normalized = url.trim().replace(/\/+$/, "");
    const sources = await prisma.icalSource.findMany({ select: { id: true, url: true } });
    for (const source of sources) {
      if (source.url.trim().replace(/\/+$/, "") !== normalized) continue;
      await prisma.$transaction([
        prisma.blockedDate.deleteMany({ where: { source: `ical-${source.id}` } }),
        prisma.icalSource.delete({ where: { id: source.id } }),
      ]);
    }
  } catch (error) {
    console.error("[connectors] legacy iCal source could not be retired", error);
  }
}
