import { test, expect } from "@playwright/test";
import { provision } from "./provision";
import { navigation } from "../../../src/cala/features/workspace/navigation";

test("all current modules fit the phone and installation help is reachable", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await provision(page, info);
  for (const item of navigation) {
    await page.goto("/" + item.path);
    await expect(page.locator(".m-app-main")).toHaveAttribute(
      "data-section",
      item.path,
    );
    await expect(page.locator(".m-app-main h1").first()).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          ),
        { message: `Page overflow on ${item.path}` },
      )
      .toBeLessThanOrEqual(1);
    if (["inicio", "inbox", "reportes"].includes(item.path))
      await page.screenshot({
        path: info.outputPath(`mobile-${item.path}.png`),
        fullPage: true,
      });
  }
  await page.getByRole("button", { name: "Más herramientas" }).click();
  await page.screenshot({
    path: info.outputPath("mobile-more.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Cómo instalar", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Instalar CALA" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "iPhone y iPad" }),
  ).toBeVisible();
});
