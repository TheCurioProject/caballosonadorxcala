import { test, expect } from "vitest";
import { seedState } from "../fixtures/seed";
import { LocalPersistenceAdapter } from "@/cala/infrastructure/persistence/local";
import { ApplicationService } from "@/cala/application/service";
import { snapshot } from "@/cala/application/queries";
import { defaultWorkspacePreferences } from "@/cala/domain/workspace/preferences";
const owner = { userId: "user-owner", stepUpUntil: null };
test("personal workspace defaults are private, versioned and idempotent across sessions", () => {
  const store = new LocalPersistenceAdapter(":memory:", seedState),
    app = new ApplicationService(store);
  const command = {
    type: "workspace.preferences.save",
    organizationId: "org-estancia",
    version: 0,
    preferences: structuredClone(defaultWorkspacePreferences),
    userId: "user-housekeeping",
  };
  const first = app.execute(owner, command, "preferences-first");
  expect(app.execute(owner, command, "preferences-first")).toEqual(first);
  expect(store.read().workspacePreferences).toHaveLength(1);
  expect(store.read().workspacePreferences?.[0].userId).toBe(owner.userId);
  const housekeeping = { userId: "user-housekeeping", stepUpUntil: null };
  expect(snapshot(store.read(), housekeeping).workspacePreferences).toEqual([]);
  app.execute(housekeeping, command, "preferences-housekeeping");
  expect(snapshot(store.read(), owner).workspacePreferences).toHaveLength(1);
  expect(
    snapshot(store.read(), housekeeping).workspacePreferences?.[0].userId,
  ).toBe(housekeeping.userId);
  app.execute(
    owner,
    {
      ...command,
      version: 1,
      preferences: {
        ...command.preferences,
        calendar: { ...command.preferences.calendar, view: "year" },
      },
    },
    "preferences-second",
  );
  expect(() =>
    app.execute(owner, { ...command, version: 1 }, "preferences-stale"),
  ).toThrow();
  expect(() =>
    app.execute(
      { userId: "user-other", stepUpUntil: null },
      command,
      "preferences-other-tenant",
    ),
  ).toThrow();
  expect(
    store.read().workspacePreferences?.find((p) => p.userId === owner.userId)
      ?.version,
  ).toBe(2);
  store.close();
});
test("guest profile extensions survive older writers and obey versions, validation and PII permissions", () => {
  const store = new LocalPersistenceAdapter(":memory:", seedState),
    app = new ApplicationService(store);
  const guest = store.read().guests[0];
  const command = {
    type: "guest.save",
    organizationId: "org-estancia",
    propertyId: "property-hotel",
    id: guest.id,
    version: guest.version,
    firstName: guest.firstName,
    lastName: guest.lastName,
    email: guest.email,
    phone: guest.phone,
    country: guest.country,
    notes: guest.notes,
  };
  app.execute(
    owner,
    {
      ...command,
      address: "Calle privada de prueba 12",
      company: "Empresa de prueba",
      city: "Tepic",
      region: "Nayarit",
      postalCode: "63000",
      language: "en-GB",
    },
    "profile-extended",
  );
  app.execute(
    owner,
    { ...command, version: guest.version + 1, firstName: "Nombre editado" },
    "profile-older-writer",
  );
  expect(store.read().guests.find((g) => g.id === guest.id)).toMatchObject({
    address: "Calle privada de prueba 12",
    language: "en-GB",
    firstName: "Nombre editado",
    version: guest.version + 2,
  });
  expect(() => app.execute(owner, command, "profile-stale")).toThrow();
  expect(() =>
    app.execute(
      owner,
      { ...command, version: guest.version + 2, address: "x".repeat(401) },
      "profile-too-long",
    ),
  ).toThrow();
  expect(() =>
    app.execute(
      owner,
      { ...command, version: guest.version + 2, language: "English<script>" },
      "profile-invalid-language",
    ),
  ).toThrow();
  expect(() =>
    app.execute(
      { userId: "user-housekeeping", stepUpUntil: null },
      command,
      "profile-no-pii",
    ),
  ).toThrow();
  expect(
    snapshot(store.read(), { userId: "user-housekeeping", stepUpUntil: null })
      .guests,
  ).toEqual([]);
  expect(JSON.stringify(store.read().audits)).not.toContain(
    "Calle privada de prueba",
  );
  store.close();
});
