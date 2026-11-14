import { revalidatePath, revalidateTag } from "next/cache";

/** Tags of the cached reads behind public pages (see src/app/[lang]/page.tsx). */
export const PUBLIC_CACHE_TAGS = ["amenities", "experiences"] as const;

/**
 * The public website belongs exclusively to Casa Caballo Soñador, which in
 * CALA is the property in CALA_DEFAULT_PROPERTY_ID (mapped to the site via
 * pms_private.site_property_map). Other CALA properties never touch the site.
 */
export function isWebsiteProperty(propertyId: unknown) {
  const id = process.env.CALA_DEFAULT_PROPERTY_ID;
  return Boolean(id) && typeof propertyId === "string" && propertyId === id;
}

/** Drop every cached public page/data entry so the next visit is fresh. */
export function revalidatePublicSite() {
  try {
    revalidatePath("/", "layout");
    // The home page keeps "During your stay" and the experiences in tagged
    // caches (unstable_cache, 1 h): expire them too, so an edit in CALA shows
    // on the very next visit instead of up to an hour later.
    for (const tag of PUBLIC_CACHE_TAGS) revalidateTag(tag, { expire: 0 });
  } catch (error) {
    // Outside a request scope (scripts/tests) there is nothing to invalidate.
    console.warn("[revalidatePublicSite]", (error as Error).message);
  }
}
