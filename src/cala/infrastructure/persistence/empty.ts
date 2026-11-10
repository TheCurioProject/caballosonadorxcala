import type { State } from "@/cala/domain/model";

/** A clean local workspace for development without sample users or business data. */
export function emptyState(): State {
  return {
    conversations: [],
    messageEntries: [],
    messageTemplates: [],
    marketObservations: [],
    schemaVersion: 2,
    organizations: [],
    users: [],
    memberships: [],
    properties: [],
    inventoryTypes: [],
    units: [],
    guests: [],
    reservations: [],
    blocks: [],
    ratePlans: [],
    rateDays: [],
    folioItems: [],
    payments: [],
    tasks: [],
    channels: [],
    jobs: [],
    audits: [],
    outbox: [],
    automations: [],
    drafts: [],
    sessions: [],
    credentials: [],
    idempotency: [],
    externalIdentities: [],
  };
}
