import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { startFixture } from "../tests/site/supabase-fixture.mjs";
const fixture = await startFixture(),
  port = 3211,
  origin = `http://127.0.0.1:${port}`;
let browser, currentPage;
const log = [];
const errors = [];
const apiLog = [];
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    env: {
      ...process.env,
      ...fixture.env,
      NODE_ENV: "production",
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      RESEND_API_KEY: "",
      CLOUDINARY_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
child.stdout.on("data", (chunk) => log.push(String(chunk)));
child.stderr.on("data", (chunk) => log.push(String(chunk)));
async function ready() {
  for (let n = 0; n < 120; n++) {
    if (child.exitCode != null) throw new Error("Test app exited");
    try {
      if ((await fetch(origin + "/admin/login/")).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Test app did not become ready");
}
const add = (day, n) =>
  new Date(Date.parse(day + "T00:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
try {
  await ready();
  await mkdir("test-results/site", { recursive: true });
  browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await desktop.newPage();
  currentPage = page;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", async (response) => {
    if (response.url().includes("/api/cala/"))
      try {
        apiLog.push({
          url: response.url(),
          status: response.status(),
          body: (await response.text()).slice(0, 1500),
        });
      } catch {}
  });
  const unauth = await desktop.request.get(origin + "/api/cala/workspace/");
  assert.equal(unauth.status(), 401);
  const csrf = await desktop.request.post(origin + "/api/cala/commands/", {
    data: {},
    headers: { Origin: "https://another.example" },
  });
  assert.equal(csrf.status(), 403);
  await page.goto(origin + "/admin/inicio/");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .waitFor();
  await page.getByLabel("Correo", { exact: true }).fill("owner@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Fixture-only-password-2026");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.locator(".sidebar").waitFor({ timeout: 45000 });
  const snapshotResponse = await desktop.request.get(
    origin + "/api/cala/workspace/",
  );
  assert.equal(snapshotResponse.status(), 200);
  const snapshot = await snapshotResponse.json();
  assert.equal(snapshot.analyticsComplete, true);
  assert.equal(snapshot.reservations.length, 1);
  assert.equal(snapshot.currentOrganizationId, fixture.scope.organizationId);
  assert.equal(await page.locator("body").getAttribute("class"), "cala-admin");
  assert.match(
    await page
      .locator("h1")
      .first()
      .evaluate((element) => getComputedStyle(element).fontFamily),
    /Instrument Sans/i,
  );
  await page.screenshot({
    path: "test-results/site/desktop-home.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Calendario", exact: true })
    .first()
    .click();
  await page.locator(".calendar-booking").first().waitFor();
  const privateHeaders = await desktop.request.get(
    origin + "/admin/calendario/",
  );
  assert.match(privateHeaders.headers()["cache-control"], /no-store/);
  assert.match(
    privateHeaders.headers()["content-security-policy"],
    /frame-ancestors 'none'/,
  );
  const target = page.getByRole("button", {
    name: `Reservar unidad Casa Caballo Soñador el ${add(fixture.today, 6)}`,
    exact: true,
  });
  await page
    .getByLabel("También mover fechas al arrastrar", { exact: true })
    .check();
  await page.locator(".calendar-booking").first().dragTo(target);
  await page
    .getByRole("button", { name: "Confirmar movimiento", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Confirmar movimiento", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Confirmar movimiento", exact: true })
    .waitFor({ state: "hidden" });
  const moved = (
    await (await desktop.request.get(origin + "/api/cala/workspace/")).json()
  ).reservations[0];
  assert.notEqual(moved.arrival, snapshot.reservations[0].arrival);
  assert.equal(moved.totalMinor, snapshot.reservations[0].totalMinor);
  await fixture.db.exec("reset role");
  const siteRow = (
    await fixture.db.query(
      "select start_date::date::text as arrival from site.reservas order by id limit 1",
    )
  ).rows[0];
  assert.equal(siteRow.arrival, moved.arrival);
  await page.screenshot({
    path: "test-results/site/desktop-calendar.png",
    fullPage: true,
  });
  // The same private session uses the independent touch UI at narrow widths.
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    storageState: await desktop.storageState(),
  });
  const phone = await mobile.newPage();
  phone.on("pageerror", (error) => errors.push(error.message));
  await phone.goto(origin + "/admin/calendario/");
  await phone
    .getByRole("navigation", { name: "Navegación móvil", exact: true })
    .waitFor({ timeout: 45000 });
  assert.equal(await phone.locator(".sidebar").count(), 0);
  assert.equal(
    await phone.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  await phone
    .getByRole("button", { name: "Más herramientas", exact: true })
    .click();
  await phone
    .getByRole("link", { name: "Contenido e imágenes", exact: true })
    .waitFor();
  await phone.waitForFunction(() =>
    [...document.querySelectorAll('[role="dialog"]')].every((dialog) => {
      for (let element = dialog; element; element = element.parentElement) {
        if (Number(getComputedStyle(element).opacity) < 0.999) return false;
      }
      return true;
    }),
  );
  await phone.screenshot({
    path: "test-results/site/mobile-menu.png",
    fullPage: true,
  });
  await phone.keyboard.press("Escape");
  await phone.goto(origin + "/admin/inbox/");
  await phone
    .getByRole("navigation", { name: "Navegación móvil", exact: true })
    .waitFor();
  await phone.screenshot({
    path: "test-results/site/mobile-inbox.png",
    fullPage: true,
  });
  const manifestResponse = await desktop.request.get(
    origin + "/admin/manifest.webmanifest",
  );
  assert.equal(manifestResponse.status(), 200);
  assert.match(
    manifestResponse.headers()["content-type"],
    /application\/manifest\+json/,
  );
  const manifest = await manifestResponse.json();
  assert.equal(manifest.scope, "/admin/");
  assert.equal(manifest.start_url, "/admin/inicio/");
  const sw = await desktop.request.get(origin + "/admin/sw.js");
  assert.equal(sw.status(), 200);
  assert.match(await sw.text(), /Never cache authenticated/);
  const logout = await desktop.request.post(origin + "/api/cala/session/", {
    data: { action: "logout" },
    headers: { Origin: origin },
  });
  assert.equal(logout.status(), 200);
  assert.equal(
    (await desktop.request.get(origin + "/api/cala/workspace/")).status(),
    401,
  );
  await page.goto(origin + "/admin/login/");
  const publicDocument = page.waitForResponse(
    (response) =>
      response.request().isNavigationRequest() &&
      response.request().resourceType() === "document" &&
      new URL(response.url()).pathname === "/es/",
  );
  await page
    .getByRole("link", { name: "Volver a la web", exact: true })
    .click();
  const publicResponse = await publicDocument;
  assert.equal(publicResponse.status(), 200);
  assert.equal(
    Boolean(
      publicResponse
        .headers()
        ["content-security-policy"]?.includes("frame-ancestors 'none'"),
    ),
    false,
  );
  await page.waitForFunction(
    () => !document.body.classList.contains("cala-admin"),
  );
  await page.locator("h1").first().waitFor();
  assert.match(
    await page
      .locator("h1")
      .first()
      .evaluate((element) => getComputedStyle(element).fontFamily),
    /Cormorant/i,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser integration passed: private login/logout, CSRF, complete snapshot, desktop drag with transactional website mirror, mobile navigation, scoped PWA and no browser exceptions.",
  );
} catch (error) {
  await currentPage?.screenshot({
    path: "test-results/site/failure.png",
    fullPage: true,
  });
  await writeFile(
    "test-results/site/failure.json",
    JSON.stringify(
      {
        error: String(error),
        body: await currentPage?.locator("body").innerText(),
        apiLog,
        errors,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser?.close();
  child.kill("SIGTERM");
  await fixture.close();
  await mkdir("test-results/site", { recursive: true });
  await writeFile("test-results/site/server.log", log.join(""));
}
