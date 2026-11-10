import type { Job, Permission } from "../model";
export function jobPermission(type: Job["type"]): Permission {
  return (
    {
      ical_import: "channel.manage",
      migration: "migration.manage",
      channel_sync: "channel.manage",
      report: "report.read",
      automation: "automation.write",
      payment: "finance.write",
    } as const
  )[type];
}
