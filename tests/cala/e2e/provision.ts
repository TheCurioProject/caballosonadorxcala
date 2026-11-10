import { randomUUID } from "node:crypto";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { finishAssistant, registerFresh } from "./helpers";
import type { Snapshot } from "../../../src/cala/domain/model";
import { addDays } from "../../../src/cala/domain/shared/dates";
export async function provision(page: Page, info: TestInfo) {
  await registerFresh(page, info);
  await finishAssistant(page);
  let data = (await (
    await page.request.get("/api/workspace")
  ).json()) as Snapshot;
  async function command(input: Record<string, unknown>) {
    const response = await page.request.post("/api/commands", {
      headers: {
        Origin: "http://127.0.0.1:3100",
        "Idempotency-Key": randomUUID(),
      },
      data: {
        organizationId: data.currentOrganizationId,
        propertyId: data.currentPropertyId,
        ...input,
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()) as { id: string };
  }
  const property = await command({
    type: "property.create",
    name: "Cala Costa",
    concept: "hotel",
    city: "Mazatlán",
    address: "Calle de prueba 1",
    currency: "MXN",
    timezone: "America/Mazatlan",
    unitCount: 2,
    maxOccupancy: 2,
    baseRateMinor: 100000,
    sellMode: "unit",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["wifi"],
    checkIn: "15:00",
    checkOut: "11:00",
    policy: "Política de prueba",
    taxBps: 0,
  });
  data = (await (
    await page.request.get(
      `/api/workspace?organizationId=${data.currentOrganizationId}&propertyId=${property.id}`,
    )
  ).json()) as Snapshot;
  const guest = await command({
    type: "guest.save",
    firstName: "Ana",
    lastName: "López",
    email: "guest@example.com",
    phone: "",
    country: "MX",
    notes: "",
  });
  const reservation = await command({
    type: "reservation.save",
    guestId: guest.id,
    inventoryTypeId: data.inventoryTypes[0].id,
    unitId: data.units[0].id,
    ratePlanId: data.ratePlans[0].id,
    arrival: data.today,
    departure: addDays(data.today, 3),
    adults: 2,
    children: 0,
    notes: "",
    status: "confirmed",
  });
  return { data, reservation, command };
}
