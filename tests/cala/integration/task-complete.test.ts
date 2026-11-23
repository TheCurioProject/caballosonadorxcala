import { test, expect } from "vitest";
import { LocalPersistenceAdapter } from "@/cala/infrastructure/persistence/local";
import { seedState } from "../fixtures/seed";
import { ApplicationService } from "@/cala/application/service";

// The local adapter mirrors the database rule: a task is closed by its
// assignee or by a lead; closing housekeeping marks the room clean.
const base = { organizationId: "org-estancia", propertyId: "property-hotel" };
const actor = (role: string) => ({ userId: "user-" + role, stepUpUntil: null });

test("task.complete: assignee or lead only, and the room is left clean", () => {
  const store = new LocalPersistenceAdapter(":memory:", seedState);
  const app = new ApplicationService(store);
  // Housekeeping cannot close the manager's maintenance task.
  expect(() =>
    app.execute(actor("housekeeping"), { type: "task.complete", ...base, id: "task-2" }, "close-other"),
  ).toThrow(/asignada a otra persona/);
  // Front desk (no lead) cannot close Housekeeping's task either.
  expect(() =>
    app.execute(actor("front_desk"), { type: "task.complete", ...base, id: "task-1" }, "close-desk"),
  ).toThrow(/asignada a otra persona/);
  // Finance has no operations rights.
  expect(() =>
    app.execute(actor("finance"), { type: "task.complete", ...base, id: "task-1" }, "close-finance"),
  ).toThrow();

  app.execute(actor("housekeeping"), { type: "task.complete", ...base, id: "task-1" }, "close-own");
  const state = store.read();
  expect(state.tasks.find((t) => t.id === "task-1")?.status).toBe("completed");
  expect(state.units.find((u) => u.id === "unit-hotel-3")?.housekeeping).toBe("clean");

  // The owner may reopen or close anyone's task.
  app.execute(actor("owner"), { type: "task.complete", ...base, id: "task-2", status: "completed" }, "close-lead");
  expect(store.read().tasks.find((t) => t.id === "task-2")?.status).toBe("completed");
  store.close();
});
