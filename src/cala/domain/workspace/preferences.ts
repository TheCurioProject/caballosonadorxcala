import { z } from "zod";

export const workspacePreferencesSchema = z
  .object({
    calendar: z
      .object({
        view: z.enum(["timeline", "month", "year"]),
        scope: z.enum(["property", "organization"]),
        days: z.union([
          z.literal(7),
          z.literal(14),
          z.literal(30),
          z.literal(90),
        ]),
        stickyUnits: z.boolean(),
        guest: z.boolean(),
        channel: z.boolean(),
        guests: z.boolean(),
        price: z.boolean(),
        nights: z.boolean(),
        tooltip: z.boolean(),
      })
      .strict(),
    dashboard: z
      .object({
        metrics: z.boolean(),
        daily: z.boolean(),
        activity: z.boolean(),
        setup: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type WorkspacePreferences = z.infer<typeof workspacePreferencesSchema>;
export const defaultWorkspacePreferences: WorkspacePreferences = {
  calendar: {
    view: "timeline",
    scope: "organization",
    days: 14,
    stickyUnits: true,
    guest: true,
    channel: true,
    guests: false,
    price: false,
    nights: false,
    tooltip: true,
  },
  dashboard: { metrics: true, daily: true, activity: true, setup: true },
};
export function workspacePreferences(value: unknown): WorkspacePreferences {
  const parsed = workspacePreferencesSchema.safeParse(value);
  return parsed.success
    ? parsed.data
    : structuredClone(defaultWorkspacePreferences);
}
