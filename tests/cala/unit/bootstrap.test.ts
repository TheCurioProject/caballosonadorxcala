import { test, expect } from "vitest";
import { assets } from "@/cala/assets/registry";
import {
  AMENITY_KEYS,
  amenityCatalog,
  timeZoneOptions,
} from "@/cala/domain/properties/options";
test("registry contains every supplied asset", () => {
  expect(Object.keys(assets)).toHaveLength(110);
  expect(assets.home).toBe("/cala/assets/icons/home.svg");
});
test("property setup options are complete, stable and unique", () => {
  expect(AMENITY_KEYS).toHaveLength(24);
  expect(new Set(AMENITY_KEYS).size).toBe(AMENITY_KEYS.length);
  expect(amenityCatalog.find((amenity) => amenity.key === "wifi")?.label).toBe(
    "Wi-Fi",
  );
  expect(timeZoneOptions.length).toBeGreaterThan(300);
  expect(timeZoneOptions.some((option) => option.value === "UTC")).toBe(true);
  expect(
    timeZoneOptions.some((option) => option.value === "America/Mexico_City"),
  ).toBe(true);
});
