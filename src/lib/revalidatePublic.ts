import { revalidatePath } from "next/cache";

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
  } catch (error) {
    // Outside a request scope (scripts/tests) there is nothing to invalidate.
    console.warn("[revalidatePublicSite]", (error as Error).message);
  }
}
