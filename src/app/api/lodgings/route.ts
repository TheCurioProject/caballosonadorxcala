import { NextResponse } from "next/server";
import { calaConfiguration } from "@/lib/cala/config";
import { getLodgings } from "@/lib/lodgings.server";
import { getSiteImages } from "@/lib/siteImages.server";
import { getImageUrl } from "@/lib/siteImages";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!calaConfiguration().ready)
    return NextResponse.json(
      { error: "Las reservas están en preparación." },
      { status: 503 },
    );
  try {
    const [catalog, images] = await Promise.all([
      getLodgings(),
      getSiteImages(),
    ]);
    return NextResponse.json(
      {
        lodgings: catalog.map((l) => ({
          ...l,
          images: l.photoKeys
            .map((key) => getImageUrl(key, images))
            .filter(Boolean),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo cargar el catálogo. Inténtalo de nuevo." },
      { status: 503 },
    );
  }
}
