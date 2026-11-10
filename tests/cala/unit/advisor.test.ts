import { expect, test } from "vitest";
import { seedState } from "../fixtures/seed";
import { snapshot } from "@/cala/application/queries";
import { runAdvisor, advisorEnglish } from "@/cala/domain/analytics/advisor";
import {
  demandCalendar,
  demandOn,
} from "@/cala/domain/analytics/advisor-knowledge";

test("demand calendar knows movable Mexican holidays", () => {
  const easter2027 = demandCalendar(2027).find((p) =>
    p.label.startsWith("Semana Santa"),
  )!;
  // Easter Sunday 2027 is March 28.
  expect(easter2027.start).toBe("2027-03-21");
  expect(easter2027.end).toBe("2027-04-04");
  expect(demandOn("2026-12-24")?.level).toBe("alta");
  expect(demandOn("2026-10-07")).toBeNull();
});

test("market agent investigates, analyzes and returns ranked, translatable advice", () => {
  const s = seedState();
  const owner = s.memberships.find((m) => m.role === "owner")!;
  const data = snapshot(
    s,
    { userId: owner.userId } as never,
    owner.organizationId,
  );
  const report = runAdvisor(data, (minor) => String(minor / 100));
  expect(report.steps).toHaveLength(4);
  expect(report.recommendations.length).toBeGreaterThan(0);
  const priorities = report.recommendations.map((r) => r.priority);
  expect([...priorities].sort()).toEqual(priorities);
  for (const r of report.recommendations)
    for (const key of [r.title, r.why, r.action])
      expect(advisorEnglish[key]).toBeTruthy();
});
