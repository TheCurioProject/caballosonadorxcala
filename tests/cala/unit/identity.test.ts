import { test, expect } from "vitest";
import { seedState } from "../fixtures/seed";
import { authorize } from "@/cala/domain/identity/permissions";
import { developmentEnabled } from "@/cala/lib/runtime";
test("tenant isolation and property scope", () => {
  const s = seedState();
  expect(() =>
    authorize(
      s,
      { userId: "user-owner", stepUpUntil: null },
      "org-other",
      "property.read",
    ),
  ).toThrow();
  expect(() =>
    authorize(
      s,
      { userId: "user-manager", stepUpUntil: null },
      "org-estancia",
      "property.read",
      "property-home",
    ),
  ).toThrow();
  expect(() =>
    authorize(
      s,
      { userId: "user-housekeeping", stepUpUntil: null },
      "org-estancia",
      "finance.read",
    ),
  ).toThrow();
});
test("suspended membership is rejected", () => {
  const s = seedState();
  s.memberships[0].status = "suspended";
  expect(() =>
    authorize(
      s,
      { userId: "user-owner", stepUpUntil: null },
      "org-estancia",
      "property.read",
    ),
  ).toThrow();
});
test("production cannot enable dev adapters", () => {
  expect(
    developmentEnabled({ NODE_ENV: "production", APP_ENV: "development" }),
  ).toBe(false);
  expect(
    developmentEnabled({ NODE_ENV: "development", APP_ENV: "production" }),
  ).toBe(false);
  expect(developmentEnabled({ NODE_ENV: "development", VERCEL: "1" })).toBe(
    false,
  );
});
