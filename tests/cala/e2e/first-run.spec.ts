import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { finishAssistant, registerFresh } from "./helpers";

test("large-screen welcome stays inside a single viewport", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/inicio");
  await expect(
    page.getByRole("heading", { name: "Bienvenido a CALA" }),
  ).toBeVisible();
  const registrationFits = await page.evaluate(() => {
    const welcome = document.querySelector<HTMLElement>(".welcome-auth");
    return Boolean(
      welcome &&
        Math.abs(welcome.getBoundingClientRect().height - window.innerHeight) <
          1 &&
        document.documentElement.scrollHeight <= window.innerHeight,
    );
  });
  expect(registrationFits).toBe(true);

  await registerFresh(page, info);
  const assistantFits = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".assistant-shell");
    return Boolean(
      shell &&
        shell.getBoundingClientRect().top >= 0 &&
        shell.getBoundingClientRect().bottom <= window.innerHeight &&
        shell.scrollHeight <= shell.clientHeight,
    );
  });
  expect(assistantFits).toBe(true);
});

test("new account completes the CALA first-run journey", async ({
  page,
}, info) => {
  await page.goto("/inicio");
  await expect(
    page.getByRole("heading", { name: "Bienvenido a CALA" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/cala-registration-${info.project.name}.png`,
    fullPage: true,
  });
  await registerFresh(page, info);
  await expect(
    page.getByRole("dialog", {
      name: "Bienvenido a una forma más tranquila de operar.",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/cala-assistant-${info.project.name}.png`,
    fullPage: true,
  });
  await finishAssistant(page);
  await page.goto("/inicio");
  await expect(page.getByRole("heading", { name: "Hola, Ana." })).toBeVisible();
  await page.screenshot({
    path: `test-results/cala-workspace-${info.project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hola, Ana." })).toBeVisible();
});

test("assistant can be skipped and reopened from the workspace", async ({
  page,
}, info) => {
  await registerFresh(page, info);
  await page.getByRole("button", { name: "Omitir tutorial" }).click();
  await expect(
    page.getByRole("heading", { name: "Configuremos tu propiedad" }),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Abrir asistente de CALA" }).click();
  await expect(page.getByRole("menuitem", { name: /Tutorial/ })).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: /Primeros pasos/ }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: /Tutorial/ }).click();
  await expect(
    page.getByRole("dialog", {
      name: "Bienvenido a una forma más tranquila de operar.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Omitir tutorial" }).click();
  await page.goto("/inicio");
  await expect(page.getByRole("heading", { name: "Hola, Ana." })).toBeVisible();
  await page.getByRole("button", { name: "Abrir asistente de CALA" }).click();
  await page.getByRole("menuitem", { name: /Primeros pasos/ }).click();
  await expect(
    page.getByRole("heading", { name: "Configuremos tu propiedad" }),
  ).toBeVisible();
});

test("registration and assistant meet WCAG AA automated checks", async ({
  page,
}, info) => {
  await page.goto("/inicio");
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await registerFresh(page, info);
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
