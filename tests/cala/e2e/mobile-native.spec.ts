import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { provision } from "./provision";
import type { Snapshot } from "../../../src/cala/domain/model";

test("mobile provides rooms, month and stable agenda with every desktop module reachable", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await provision(page, info);
  await page.goto("/calendario");
  await expect(page.locator(".cala-mobile-shell")).toBeVisible();
  await expect(page.locator(".m-room-stay")).toHaveCount(1);
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  const days = await page.locator(".m-week-strip button").allTextContents();
  await page.locator(".m-week-strip button").nth(3).click();
  expect(await page.locator(".m-week-strip button").allTextContents()).toEqual(
    days,
  );
  await page.getByRole("button", { name: "Mes", exact: true }).click();
  await expect(page.locator(".m-month-grid button")).toHaveCount(42);
  await page.getByRole("button", { name: "Más herramientas" }).click();
  const dialog = page.getByRole("dialog");
  for (const name of [
    "Tarifas y restricciones",
    "Finanzas",
    "Inventario",
    "Plantillas de mensajes",
    "Equipo y permisos",
    "Configuración",
  ])
    await expect(dialog.getByRole("link", { name, exact: true })).toBeVisible();
  await dialog
    .getByRole("link", { name: "Tarifas y restricciones", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tarifas y restricciones", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Navegación móvil" })
    .getByRole("link", { name: "Calendario", exact: true })
    .click();
  await expect(page.locator(".m-room-stay")).toHaveCount(1);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 844, height: 390 });
  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    screen: [screen.width, screen.height],
    touch: navigator.maxTouchPoints,
    coarse: matchMedia("(pointer: coarse)").matches,
  }));
  await expect(
    page.locator(".cala-mobile-shell"),
    JSON.stringify(viewport),
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 664 });
  await expect(page.locator(".cala-mobile-shell")).toBeVisible();
  // Full-page capture currently disables touch emulation in this Chrome runner.
  // Keep device/orientation assertions ahead of it.
  await page.screenshot({
    path: info.outputPath("mobile-calendar-rooms.png"),
    fullPage: true,
  });
});

test("touch drag proposes a safe room change before committing", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  const { data, reservation } = await provision(page, info);
  await page.goto("/calendario");
  await expect(page.locator(".m-room-drag")).toBeVisible();
  const grip = await page.locator(".m-room-drag").boundingBox(),
    target = await page
      .locator(`[data-mobile-unit="${data.units[1].id}"]`)
      .boundingBox();
  if (!grip || !target) throw Error("Missing touch targets");
  const client = await page.context().newCDPSession(page);
  const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 },
    to = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [from],
  });
  for (let i = 1; i <= 5; i++)
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * i) / 5,
          y: from.y + ((to.y - from.y) * i) / 5,
        },
      ],
    });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.detach();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Confirmar movimiento" }),
  ).toBeVisible();
  const before = (await (
    await page.request.get(
      `/api/workspace?organizationId=${data.currentOrganizationId}&propertyId=${data.currentPropertyId}`,
    )
  ).json()) as Snapshot;
  expect(before.reservations.find((r) => r.id === reservation.id)?.unitId).toBe(
    data.units[0].id,
  );
  await dialog
    .getByRole("button", { name: "Confirmar movimiento", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const after = (await (
    await page.request.get(
      `/api/workspace?organizationId=${data.currentOrganizationId}&propertyId=${data.currentPropertyId}`,
    )
  ).json()) as Snapshot;
  expect(after.reservations.find((r) => r.id === reservation.id)).toMatchObject(
    { unitId: data.units[1].id, arrival: data.today, totalMinor: 300000 },
  );
});

test("PWA stores only public resources and blocks offline writes without losing the draft", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  const { data } = await provision(page, info);
  await page.goto("/inbox");
  await expect(page.locator(".cala-mobile-shell")).toBeVisible();
  await page.getByRole("button", { name: /Ana López/ }).click();
  await page
    .getByRole("textbox", { name: "Mensaje", exact: true })
    .fill("Borrador privado sin conexión");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  const keys = await page.evaluate(async () => {
    const result: string[] = [];
    for (const key of await caches.keys())
      for (const request of await (await caches.open(key)).keys())
        result.push(new URL(request.url).pathname);
    return result;
  });
  expect(keys).toContain("/offline.html");
  expect(
    keys.every((path) => path === "/offline.html" || path.startsWith("/pwa/")),
  ).toBe(true);
  let writes = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/commands") && r.method() === "POST") writes++;
  });
  await page.context().setOffline(true);
  await expect(page.locator(".m-connection-banner")).toContainText(
    "Sin conexión",
  );
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(page.getByRole("alert").first()).toContainText("Sin conexión");
  expect(writes).toBe(0);
  await expect(
    page.getByRole("textbox", { name: "Mensaje", exact: true }),
  ).toHaveValue("Borrador privado sin conexión");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Volvemos en cuanto tengas conexión." }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("offline.png"),
    fullPage: true,
  });
  await page.context().setOffline(false);
  await page.getByRole("link", { name: "Volver a intentar" }).click();
  await expect(page.getByRole("heading", { name: "Hola, Ana." })).toBeVisible();
  const final = (await (
    await page.request.get(
      `/api/workspace?organizationId=${data.currentOrganizationId}&propertyId=${data.currentPropertyId}`,
    )
  ).json()) as Snapshot;
  expect(final.messageEntries).toEqual([]);
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
});

test("a delayed read from the previous property cannot overwrite the new property", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  const { data, command } = await provision(page, info);
  const second = await command({
    type: "property.create",
    name: "Cala Montaña",
    concept: "hotel",
    city: "Durango",
    address: "Calle 2",
    currency: "MXN",
    timezone: "America/Mexico_City",
    unitCount: 1,
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
  await page.goto("/inicio");
  await expect(page.locator(".m-property-trigger")).toContainText("Cala Costa");
  let release!: () => void,
    ready!: () => void,
    held = false;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    started = new Promise<void>((resolve) => {
      ready = resolve;
    });
  await page.route("**/api/workspace?**", async (route) => {
    const url = new URL(route.request().url());
    if (
      !held &&
      url.searchParams.get("propertyId") === data.currentPropertyId
    ) {
      held = true;
      const response = await route.fetch();
      ready();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await started;
    await page
      .getByRole("button", { name: "Cambiar propiedad", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Cala Montaña/ })
      .click();
    await expect(page.locator(".m-property-trigger")).toContainText(
      "Cala Montaña",
    );
    const nextRead = page.waitForResponse(
      (r) =>
        r.url().includes("/api/workspace?") &&
        new URL(r.url()).searchParams.get("propertyId") === second.id,
      { timeout: 15000 },
    );
    release();
    await nextRead;
    await expect(page.locator(".m-property-trigger")).toContainText(
      "Cala Montaña",
    );
  } finally {
    release();
  }
});

test("desktop keeps its original workspace while mobile uses a separate composition", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  await provision(page, info);
  await page.goto("/calendario");
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator(".stay-calendar")).toBeVisible();
  await expect(page.locator(".cala-mobile-shell")).toHaveCount(0);
  const before = await page.locator(".sidebar").boundingBox();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".cala-mobile-shell")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".app-shell")).toBeVisible();
  expect(await page.locator(".sidebar").boundingBox()).toEqual(before);
  await expect(page.locator(".stay-calendar")).toBeVisible();
});
