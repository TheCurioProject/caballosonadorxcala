import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { provision } from "./provision";
import type { Snapshot } from "../../../src/cala/domain/model";

test("calendar moves a continuous stay and preserves its agreed price", async ({
  page,
}, info) => {
  const { data, reservation } = await provision(page, info);
  await page.goto("/calendario");
  await expect(
    page.getByRole("heading", { name: "Calendario", exact: true }),
  ).toBeVisible();
  if (info.project.name === "desktop") {
    await expect(page.locator(".stay-pill")).toHaveCount(1);
    await page
      .locator(".stay-pill")
      .dragTo(
        page
          .locator(`[data-calendar-unit="${data.units[1].id}"] .stay-cell`)
          .first(),
      );
  } else {
    await page
      .getByRole("button", { name: "Mover estancia", exact: true })
      .click();
    await page
      .getByRole("button", { name: /Ana López · CALA-|Ana López · EST-/ })
      .click();
  }
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Confirmar movimiento" }),
  ).toBeVisible();
  await dialog
    .getByLabel("Habitación de destino")
    .selectOption(data.units[1].id);
  await dialog
    .getByRole("button", { name: "Confirmar movimiento", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const snapshot = (await (
    await page.request.get(
      `/api/workspace?organizationId=${data.currentOrganizationId}&propertyId=${data.currentPropertyId}`,
    )
  ).json()) as Snapshot;
  const moved = snapshot.reservations.find((r) => r.id === reservation.id)!;
  expect(moved.unitId).toBe(data.units[1].id);
  expect(moved.totalMinor).toBe(300000);
  expect(moved.arrival).toBe(data.today);
  await page.screenshot({
    path: info.outputPath("calendar.png"),
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("inbox persists drafts and notes and never reports delivery without a provider", async ({
  page,
}, info) => {
  await provision(page, info);
  await page.goto("/inbox");
  await page.getByRole("button", { name: /Ana López/ }).click();
  await page.getByLabel("Mensaje", { exact: true }).fill("Bienvenida a CALA");
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(
    page.locator(".message-bubble").filter({ hasText: "Bienvenida a CALA" }),
  ).toBeVisible();
  await page.getByLabel("Tipo de mensaje").selectOption("note");
  await page
    .getByLabel("Nota para el equipo")
    .fill("Preparar llegada sin almohadas de plumas");
  await page
    .getByRole("button", { name: "Guardar nota interna", exact: true })
    .click();
  await expect(page.locator(".message-bubble.internal")).toContainText(
    "Preparar llegada",
  );
  await page.getByLabel("Tipo de mensaje").selectOption("prepare");
  await page
    .getByLabel("Mensaje", { exact: true })
    .fill("Pendiente de proveedor");
  await page
    .getByRole("button", { name: "Preparar mensaje sin enviar" })
    .click();
  await expect(page.locator(".message-delivery")).toContainText(
    "Guardado sin enviar",
  );
  await page.screenshot({ path: info.outputPath("inbox.png"), fullPage: true });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.reload();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: /Ana López/ }).click();
  else await page.getByRole("button", { name: /Ana López/ }).click();
  await expect(page.locator(".message-delivery")).toContainText(
    "Guardado sin enviar",
  );
});

test("statistics export and market import use real persisted observations", async ({
  page,
}, info) => {
  const { data, command } = await provision(page, info);
  await command({
    type: "market.import",
    rows: [
      {
        date: data.today,
        observedOn: data.today,
        source: "Licensed sample",
        market: "Costa",
        currency: "MXN",
        adrMinor: 125000,
        occupancyBps: 6500,
        sampleSize: 20,
      },
    ],
  });
  await page.goto("/reportes");
  await expect(
    page.getByRole("heading", { name: "Estadísticas y reportes" }),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar CSV" }).click();
  const download = await downloading;
  const path = await download.path();
  expect(path).not.toBeNull();
  const content = await readFile(path!, "utf8");
  expect(content).toContain("alojamiento_bruto_MXN_centavos");
  expect(content).not.toContain("Ana");
  await page.getByRole("button", { name: "Tablas", exact: true }).click();
  await expect(
    page
      .getByRole("columnheader", { name: "Alojamiento bruto", exact: true })
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("statistics.png"),
    fullPage: true,
  });
  await page.goto("/mercado");
  await expect(
    page.getByRole("heading", { name: "Estudio de mercado" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "65.0%", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("market.png"),
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("templates preview real guest variables and can be reused from the inbox", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  await provision(page, info);
  await page.goto("/plantillas");
  await page
    .getByRole("button", { name: "Nueva plantilla", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Nombre", { exact: true })
    .fill("Bienvenida personal");
  await dialog
    .getByLabel("Asunto", { exact: true })
    .fill("Hola {{guest_first_name}}");
  await dialog
    .getByLabel("Contenido en texto plano")
    .fill("Hola {{guest_first_name}}, te esperamos en {{property_name}}.");
  await dialog
    .getByLabel("Vista previa con una reserva")
    .selectOption({ index: 1 });
  await expect(dialog.locator(".message-bubble")).toContainText(
    "Hola Ana, te esperamos en Cala Costa.",
  );
  await dialog
    .getByRole("button", { name: "Guardar plantilla", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.goto("/inbox");
  await page.getByRole("button", { name: /Ana López/ }).click();
  await page
    .getByLabel("Usar plantilla")
    .selectOption({ label: "Bienvenida personal · es" });
  await expect(
    page.getByRole("textbox", { name: "Mensaje", exact: true }),
  ).toHaveValue("Hola Ana, te esperamos en Cala Costa.");
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(page.locator(".message-bubble")).toContainText(
    "Hola Ana, te esperamos en Cala Costa.",
  );
});
