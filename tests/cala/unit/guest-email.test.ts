import { expect, test } from "vitest";
import { buildGuestEmail, buttonProblem } from "@/cala/domain/messaging/guest-email";
import { messageValues } from "@/cala/domain/messaging/templates";

const values = messageValues(
  {
    guest: { firstName: "Ana <b>", lastName: "López" },
    propertyName: "Casa",
    checkIn: "15:00",
    checkOut: "11:00",
    arrival: "2026-12-04",
    departure: "2026-12-07",
    confirmationCode: "AB 12&3",
    unitName: "Room 1",
    adults: 2,
    children: 1,
  },
  "es",
);

test("values: nights, guest count and written-out dates in the template language", () => {
  expect(values.nights).toBe("3");
  expect(values.guest_count).toBe("3");
  expect(values.arrival).toMatch(/diciembre/);
});

test("guest e-mail escapes guest data, links URLs and renders buttons with encoded variables", () => {
  const email = buildGuestEmail({
    subject: "Hola {{guest_first_name}}",
    body: "Te esperamos.\n\nMapa: https://maps.example.com/x.",
    buttons: [
      { label: "Check-in", url: "https://example.com/c?code={{confirmation_code}}" },
      { label: "Mal", url: "javascript:alert(1)" },
    ],
    attachments: [{ name: "Guía", fileName: "guia.pdf" }],
    propertyName: "Casa",
    locale: "es",
    values,
  });
  expect(email.subject).toBe("Hola Ana <b>");
  expect(email.html).toContain("Ana &lt;b&gt;");
  expect(email.html).not.toContain("<b>");
  expect(email.html).toContain('href="https://maps.example.com/x"');
  expect(email.html).toContain("https://example.com/c?code=AB%2012%263");
  expect(email.html).not.toContain("javascript:");
  expect(email.buttons).toHaveLength(1);
  expect(email.text).toContain("guia.pdf");
  expect(buttonProblem({ label: "", url: "https://a.b" })).not.toBe("");
  expect(buttonProblem({ label: "Llamar", url: "tel:+52 55 1234 5678" })).toBe("");
});
