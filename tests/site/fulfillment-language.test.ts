import { test, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/resend", () => ({}));
vi.mock("@/lib/pdf", () => ({}));
vi.mock("@/lib/coupons.server", () => ({}));
const { guestLanguage } = await import("@/lib/stripeFulfillment.server");

// The invoice and the e-mails go out in the language the guest used on the site.
test("the guest language comes from the checkout page, then from the booking, else Spanish", () => {
  const url = (lang: string) => ({ success_url: `https://www.casacaballosonador.com/${lang}/checkout/success/?session_id={CHECKOUT_SESSION_ID}&booking_id=7` });
  expect(guestLanguage("en", url("es"))).toBe("es"); // older bookings stored the column default "en"
  expect(guestLanguage("es", url("en"))).toBe("en");
  expect(guestLanguage("en", { success_url: null })).toBe("en");
  expect(guestLanguage(null, { success_url: null })).toBe("es");
});
