import { test, expect, beforeAll } from "vitest";
import { openSecret, sealSecret, smtpFailure } from "@/lib/cala/connectors/smtp";
import { smtpPreset } from "@/lib/cala/connectors/smtp-presets";
import { parseInbound } from "@/lib/cala/connectors/mail-parse";

beforeAll(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";
});

test("TELUS and Gmail addresses use Google's SMTP with an app password", () => {
  expect(smtpPreset("kelli9@telus.net")).toMatchObject({ host: "smtp.gmail.com", port: 465, provider: "google" });
  expect(smtpPreset("Someone@TelusPlanet.net")?.host).toBe("smtp.gmail.com");
  expect(smtpPreset("a@gmail.com")?.label).toBe("Gmail");
  expect(smtpPreset("a@example.org")).toBeNull();
});

test("the app password is sealed (AES-GCM) and only opens intact", () => {
  const sealed = sealSecret("abcdefghijklmnop");
  expect(sealed).toMatch(/^v1:/);
  expect(sealed).not.toContain("abcdefghijklmnop");
  expect(sealSecret("abcdefghijklmnop")).not.toBe(sealed); // random IV
  expect(openSecret(sealed)).toBe("abcdefghijklmnop");
  const parts = sealed.split(":");
  parts[3] = Buffer.from("tampered").toString("base64");
  expect(() => openSecret(parts.join(":"))).toThrow();
});

test("SMTP errors become actionable messages", () => {
  const google = smtpPreset("kelli9@telus.net");
  expect(smtpFailure({ code: "EAUTH", responseCode: 535, response: "535-5.7.8 Username and Password not accepted" }, google)).toMatch(/16 letras/);
  expect(smtpFailure({ responseCode: 534, response: "534-5.7.9 Application-specific password required" }, google)).toMatch(/contraseña de aplicación/);
  expect(smtpFailure({ code: "ETIMEDOUT" })).toMatch(/No se pudo conectar/);
  expect(smtpFailure({ response: "550 5.1.1 user unknown" })).toMatch(/dirección de respuesta/);
});

test("bounces name the OTA relay they were for (Booking, Airbnb, Expedia)", () => {
  const bounce = (to: string) =>
    parseInbound({
      from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
      subject: "Delivery Status Notification (Failure)",
      text: `Your message wasn't delivered to ${to} because the address couldn't be found.`,
    } as Parameters<typeof parseInbound>[0]);
  expect(bounce("ana.123@guest.booking.com")).toMatchObject({ kind: "bounce", replyTo: "ana.123@guest.booking.com" });
  expect(bounce("4f9a@reply.airbnb.com").replyTo).toBe("4f9a@reply.airbnb.com");
  expect(bounce("x1@m.expediapartnercentral.com").replyTo).toBe("x1@m.expediapartnercentral.com");
  expect(bounce("friend@example.com")).toMatchObject({ kind: "bounce", replyTo: null });
});
