import { createServer } from "node:http";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { provision } from "./provision";
import { addDays } from "../../../src/cala/domain/shared/dates";
import type { Snapshot } from "../../../src/cala/domain/model";

test("anonymous availability embeds on another origin, omits private data and revokes both public surfaces", async ({
  page,
  browser,
}, info) => {
  const { data, reservation } = await provision(page, info);
  await page.goto("/canales");
  const importedArrival = addDays(data.today, 4),
    importedDeparture = addDays(data.today, 6);
  await page
    .getByRole("button", { name: "Importar iCal", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Nombre estable del calendario")
    .fill("Calendario sintético");
  await dialog
    .getByLabel("Contenido del archivo .ics")
    .fill(
      `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-imported-event\r\nDTSTART;VALUE=DATE:${importedArrival.replaceAll("-", "")}\r\nDTEND;VALUE=DATE:${importedDeparture.replaceAll("-", "")}\r\nSEQUENCE:1\r\nDTSTAMP:20261108T000000Z\r\nEND:VEVENT\r\nEND:VCALENDAR`,
    );
  await dialog
    .getByRole("button", { name: "Revisar e importar", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(
      async () => {
        const workspace = (await (
          await page.request.get(
            `/api/workspace?organizationId=${data.currentOrganizationId}&propertyId=${data.currentPropertyId}`,
          )
        ).json()) as Snapshot;
        return workspace.jobs.find((job) => job.type === "ical_import")?.status;
      },
      { timeout: 20000 },
    )
    .toBe("completed");
  await expect(
    page.getByRole("status").filter({ hasText: "Calendario importado" }),
  ).toBeVisible({ timeout: 15000 });
  await page
    .getByRole("button", { name: "Crear / rotar enlace privado" })
    .click();
  const link = page.getByLabel("Enlace del calendario público", {
    exact: true,
  });
  await expect(link).toHaveValue(/\/disponibilidad\/[a-f0-9]{64}\?lang=es$/);
  const url = await link.inputValue();
  const ical = await page
    .getByLabel("Enlace privado", { exact: true })
    .inputValue();
  const embed = await page
    .getByLabel("Código para incrustar", { exact: true })
    .inputValue();
  expect(embed).toContain('referrerpolicy="no-referrer"');
  const anonymous = await browser.newContext({
    viewport: page.viewportSize() ?? { width: 1440, height: 1000 },
    locale: "es-MX",
    isMobile: info.project.name === "mobile",
    hasTouch: info.project.name !== "desktop",
  });
  const host = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Web de prueba</title></head><body>${embed}</body></html>`,
    );
  });
  try {
    await new Promise<void>((resolve) => host.listen(0, "127.0.0.1", resolve));
    const publicPage = await anonymous.newPage();
    const response = await publicPage.goto(url);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-security-policy"]).toContain(
      "frame-ancestors *",
    );
    expect(response?.headers()["x-frame-options"]).toBeUndefined();
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    // Next dev overrides SSR caching to no-cache; production no-store is checked by the production probe.
    expect(response?.headers()["cache-control"]).toMatch(/no-cache|no-store/);
    await expect(
      publicPage.getByRole("heading", { name: "Disponibilidad", exact: true }),
    ).toBeVisible();
    await expect(
      publicPage.locator(`[data-date="${data.today}"]`),
    ).toHaveAttribute("data-availability", "busy");
    await expect(
      publicPage.locator(`[data-date="${addDays(data.today, 3)}"]`),
    ).toHaveAttribute("data-availability", "free");
    await expect(
      publicPage.locator(`[data-date="${importedArrival}"]`),
    ).toHaveAttribute("data-availability", "busy");
    const html = await publicPage.content();
    for (const privateValue of [
      "Ana López",
      reservation.id,
      data.units[0].id,
      "guest@example.com",
    ])
      expect(html).not.toContain(privateValue);
    expect(
      (
        await anonymous.request.get("http://127.0.0.1:3100/api/workspace")
      ).status(),
    ).toBe(401);
    const feed = await anonymous.request.get(ical);
    expect(feed.status()).toBe(200);
    expect(await feed.text()).not.toContain(reservation.id);
    expect(await feed.text()).not.toContain(
      `DTSTART;VALUE=DATE:${importedArrival.replaceAll("-", "")}`,
    );
    expect(
      (
        await new AxeBuilder({ page: publicPage })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await publicPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await publicPage.screenshot({
      path: info.outputPath("availability.png"),
      fullPage: true,
    });
    await publicPage.goto(url.replace("lang=es", "lang=en"));
    await expect(
      publicPage.getByRole("heading", { name: "Availability", exact: true }),
    ).toBeVisible();
    const address = host.address();
    if (!address || typeof address === "string")
      throw Error("Missing test host");
    await publicPage.goto(`http://127.0.0.1:${address.port}`);
    await expect(
      publicPage
        .frameLocator("iframe")
        .getByRole("heading", { name: "Disponibilidad", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Revocar enlace", exact: true })
      .click();
    await expect(link).toBeHidden();
    expect((await anonymous.request.get(ical)).status()).toBe(404);
    await publicPage.goto(url);
    await expect(
      publicPage.getByRole("heading", { name: "Enlace no disponible" }),
    ).toBeVisible();
    const privatePage = await page.request.get(
      "http://127.0.0.1:3100/calendario",
    );
    expect(privatePage.headers()["x-frame-options"]).toBe("DENY");
    expect(privatePage.headers()["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
  } finally {
    await anonymous.close();
    if (host.listening)
      await new Promise<void>((resolve, reject) =>
        host.close((error) => (error ? reject(error) : resolve())),
      );
  }
});
