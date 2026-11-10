import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { provision } from "./provision";
import type { Snapshot } from "../../../src/cala/domain/model";
import { addDays } from "../../../src/cala/domain/shared/dates";

test("calendar organization overview scopes a second-property move and saves defaults across devices", async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== "desktop");
  const { data, reservation, command } = await provision(page, info);
  const second = await command({
    type: "property.create",
    name: "Cala Montaña",
    concept: "hotel",
    city: "Durango",
    address: "Calle de prueba 2",
    currency: "MXN",
    timezone: "America/Mexico_City",
    unitCount: 2,
    maxOccupancy: 2,
    baseRateMinor: 100000,
    sellMode: "unit",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: [],
    checkIn: "15:00",
    checkOut: "11:00",
    policy: "",
    taxBps: 0,
  });
  const read = async () =>
    (await (
      await page.request.get(
        `/api/workspace?organizationId=${data.currentOrganizationId}&propertyId=${data.currentPropertyId}`,
      )
    ).json()) as Snapshot;
  const next = await read(),
    units = next.units.filter((u) => u.propertyId === second.id),
    type = next.inventoryTypes.find((t) => t.propertyId === second.id)!,
    plan = next.ratePlans.find((p) => p.propertyId === second.id)!;
  const original = next.reservations.find((r) => r.id === reservation.id)!;
  const booking = await command({
    type: "reservation.save",
    propertyId: second.id,
    guestId: original.guestId,
    inventoryTypeId: type.id,
    unitId: units[0].id,
    ratePlanId: plan.id,
    arrival: addDays(data.today, 5),
    departure: addDays(data.today, 7),
    adults: 2,
    children: 0,
    status: "confirmed",
    notes: "",
  });
  await page.goto("/calendario");
  await page
    .getByLabel("Propiedades visibles", { exact: true })
    .selectOption("organization");
  await expect(page.locator(".calendar-property-heading")).toHaveCount(2);
  await page
    .locator(`[data-calendar-unit="${units[0].id}"] .stay-pill`)
    .click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Cala Montaña", { exact: true })).toBeVisible();
  await dialog
    .getByRole("button", { name: "Mover estancia", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Habitación de destino").selectOption(units[1].id);
  await dialog
    .getByRole("button", { name: "Confirmar movimiento", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  expect(
    (await read()).reservations.find((r) => r.id === booking.id),
  ).toMatchObject({
    unitId: units[1].id,
    arrival: addDays(data.today, 5),
    totalMinor: 200000,
  });
  await page.getByRole("button", { name: "Año", exact: true }).click();
  await expect(page.locator(".calendar-month-card")).toHaveCount(12);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Personalizar calendario", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Vista inicial").selectOption("year");
  await dialog.getByLabel("Número de noches", { exact: true }).check();
  await dialog.getByRole("button", { name: "Guardar preferencias" }).click();
  await expect(dialog).toBeHidden();
  const cookies = (await page.context().storageState()).cookies;
  const another = await browser.newContext({
    storageState: { cookies, origins: [] },
    viewport: { width: 1440, height: 1000 },
    locale: "es-MX",
  });
  try {
    const other = await another.newPage();
    await other.goto("http://127.0.0.1:3100/calendario");
    await expect(other.locator(".calendar-month-card")).toHaveCount(12);
    await expect(
      other.getByLabel("Propiedades visibles", { exact: true }),
    ).toHaveValue("organization");
  } finally {
    await another.close();
  }
});

test("calendar drag selection creates the exclusive block interval and release stays explicit", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  const { data } = await provision(page, info);
  await page.goto("/calendario");
  const cells = page.locator(
    `[data-calendar-unit="${data.units[1].id}"] .stay-cell`,
  );
  await cells.nth(1).scrollIntoViewIfNeeded();
  const first = await cells.nth(1).boundingBox(),
    last = await cells.nth(3).boundingBox();
  if (!first || !last) throw Error("Missing selection cells");
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  let dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Fechas seleccionadas" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Bloquear fechas", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Desde", { exact: true })).toHaveValue(
    addDays(data.today, 1),
  );
  await expect(
    dialog.getByLabel("Primer día disponible", { exact: true }),
  ).toHaveValue(addDays(data.today, 4));
  await dialog
    .getByLabel("Motivo", { exact: true })
    .fill("Mantenimiento sintético");
  await dialog.getByRole("button", { name: "Confirmar bloqueo" }).click();
  await expect(dialog).toBeHidden();
  const read = async () =>
    (await (
      await page.request.get(
        `/api/workspace?organizationId=${data.currentOrganizationId}&propertyId=${data.currentPropertyId}`,
      )
    ).json()) as Snapshot;
  expect((await read()).blocks.filter((b) => b.active)).toMatchObject([
    {
      unitId: data.units[1].id,
      arrival: addDays(data.today, 1),
      departure: addDays(data.today, 4),
    },
  ]);
  await cells.nth(1).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Liberar fechas", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Confirmar liberación" }).click();
  await expect(dialog).toBeHidden();
  expect((await read()).blocks.some((b) => b.active)).toBe(false);
  await cells.nth(5).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Añadir reserva" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(dialog.getByLabel(/^Llegada/)).toHaveValue(
    addDays(data.today, 5),
  );
  await expect(dialog.getByLabel(/^Salida/)).toHaveValue(
    addDays(data.today, 6),
  );
});

test("guest address persists and the recorded channel distributions and inbox date filters remain accessible", async ({
  page,
}, info) => {
  await provision(page, info);
  await page.goto("/huespedes");
  await page.getByRole("button", { name: "Ver perfil" }).click();
  await page.getByRole("button", { name: "Editar datos", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Empresa", { exact: true }).fill("Empresa sintética");
  await dialog
    .getByLabel("Dirección", { exact: true })
    .fill("Calle de prueba 12");
  await dialog.getByLabel("Ciudad", { exact: true }).fill("Tepic");
  await dialog
    .getByLabel("Estado o provincia", { exact: true })
    .fill("Nayarit");
  await dialog.getByLabel("Código postal", { exact: true }).fill("63000");
  await dialog.getByLabel("Idioma del huésped", { exact: true }).fill("en-GB");
  await dialog.getByRole("button", { name: "Guardar huésped" }).click();
  await expect(
    page.getByRole("dialog").getByText(/Calle de prueba 12/),
  ).toBeVisible();
  await page.goto("/reportes");
  await expect(page.locator(".channel-distribution")).toHaveCount(4);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.goto("/inbox");
  await page.locator(".inbox-date-filter summary").click();
  await page.getByLabel("Actividad desde").fill("2099-01-01");
  await expect(
    page.getByRole("heading", { name: "Sin conversaciones" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Limpiar fechas", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /Ana López/ })).toBeVisible();
  await page.screenshot({
    path: info.outputPath("inbox-date-filters.png"),
    fullPage: true,
  });
});

test("phone exposes the annual calendar and personal calendar settings without a desktop layout", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await provision(page, info);
  await page.goto("/calendario");
  await page.getByRole("button", { name: "Año", exact: true }).click();
  await expect(page.locator(".calendar-month-card")).toHaveCount(12);
  await expect(page.locator(".app-shell")).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Personalizar calendario", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Vista inicial").selectOption("month");
  await dialog.getByRole("button", { name: "Guardar preferencias" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.locator(".m-month-grid button")).toHaveCount(42);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
});
