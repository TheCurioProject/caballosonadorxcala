import { expect, test } from "@playwright/test";
import { finishAssistant, registerFresh } from "./helpers";

test("empty production workspace exposes no sample records", async ({
  page,
}, info) => {
  await registerFresh(page, info);
  await finishAssistant(page);
  await page.goto("/inicio");
  await expect(
    page.getByText("Tu próxima historia empieza aquí"),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /demostración|datos ficticios/i,
  );
});

test("CALA themes persist without browser storage becoming mandatory", async ({
  page,
}, info) => {
  await registerFresh(page, info);
  await finishAssistant(page);
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "CALA Ink", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ink");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ink");
});
