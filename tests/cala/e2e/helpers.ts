import { expect, type Page, type TestInfo } from "@playwright/test";

export async function registerFresh(page: Page, info: TestInfo) {
  const email = `cala-${info.project.name}-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
  await page.goto("/inicio");
  await page.getByLabel("Tu nombre").fill("Ana Rivera");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill("CalaSegura.2026");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Bienvenido a una forma más tranquila de operar.",
    }),
  ).toBeVisible();
  return email;
}

export async function finishAssistant(page: Page) {
  for (let step = 0; step < 4; step += 1)
    await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nombre de tu organización").fill("Casa Horizonte");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Configuremos tu propiedad" }),
  ).toBeVisible({ timeout: 20_000 });
}
