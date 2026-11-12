import type { WorkspacePreferences } from "./workspace/preferences";
export type Role =
  | "owner"
  | "admin"
  | "manager"
  | "front_desk"
  | "housekeeping"
  | "finance"
  | "viewer";
export type Permission =
  | "property.read"
  | "property.write"
  | "reservation.read"
  | "reservation.write"
  | "reservation.cancel"
  | "guest.pii.read"
  | "inventory.write"
  | "rates.write"
  | "finance.read"
  | "finance.write"
  | "channel.manage"
  | "migration.manage"
  | "team.manage"
  | "audit.read"
  | "operations.write"
  | "automation.write"
  | "report.read"
  | "message.read"
  | "message.write";
export type Concept =
  | "entire_home"
  | "hotel"
  | "boutique_hotel"
  | "villas"
  | "apartments"
  | "aparthotel"
  | "hostel"
  | "bed_and_breakfast"
  | "inn"
  | "cabins"
  | "glamping"
  | "resort"
  | "camping"
  | "multi_unit_complex"
  | "other";
export interface Organization {
  id: string;
  name: string;
  currency: string;
  timezone: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  assistantCompleted?: boolean;
}
export interface LocalCredential {
  userId: string;
  salt: string;
  passwordHash: string;
}
export interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  propertyIds: string[];
  status: "active" | "suspended";
}
export type RentalMode = "whole" | "rooms" | "both";
export interface Property {
  id: string;
  organizationId: string;
  name: string;
  concept: Concept;
  city: string;
  country: string;
  timezone: string;
  currency: string;
  address: string;
  checkIn: string;
  checkOut: string;
  policy: string;
  taxBps: number;
  allowedOverbooking: number;
  /** How a house with rooms is sold. Absent means both. */
  rentalMode?: RentalMode;
  /** True for the property published on the public website. */
  websiteLinked?: boolean;
  onboardingComplete: boolean;
  version: number;
}
export interface InventoryType {
  id: string;
  propertyId: string;
  name: string;
  sellMode: "unit" | "bed";
  maxOccupancy: number;
  baseRateMinor: number;
  amenities: string[];
  active: boolean;
}
export interface Unit {
  attributes?: { bedrooms: number; beds: number; bathrooms: number };
  id: string;
  propertyId: string;
  inventoryTypeId: string;
  name: string;
  parentUnitId: string | null;
  active: boolean;
  housekeeping: "clean" | "dirty" | "inspected";
  version: number;
}
export interface Guest {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  notes: string;
  version: number;
  company?: string;
  address?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  language?: string;
}
export type ReservationStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";
export interface Reservation {
  id: string;
  organizationId: string;
  propertyId: string;
  guestId: string;
  inventoryTypeId: string;
  unitId: string | null;
  ratePlanId: string;
  arrival: string;
  departure: string;
  adults: number;
  children: number;
  status: ReservationStatus;
  source: string;
  confirmationCode: string;
  currency: string;
  totalMinor: number;
  notes: string;
  version: number;
  createdAt: string;
}
export interface InventoryBlock {
  id: string;
  propertyId: string;
  unitId: string;
  arrival: string;
  departure: string;
  reason: string;
  active: boolean;
}
export interface RatePlan {
  id: string;
  propertyId: string;
  name: string;
  active: boolean;
}
export interface RateDay {
  id: string;
  propertyId: string;
  ratePlanId: string;
  inventoryTypeId: string;
  date: string;
  amountMinor: number;
  minStay: number;
  maxStay: number;
  closed: boolean;
  cta: boolean;
  ctd: boolean;
  version: number;
}
export interface FolioItem {
  id: string;
  propertyId: string;
  reservationId: string;
  description: string;
  amountMinor: number;
  kind: "room" | "charge" | "adjustment";
  createdAt: string;
}
export interface Payment {
  id: string;
  propertyId: string;
  reservationId: string;
  amountMinor: number;
  provider: string;
  externalId: string;
  status: "pending" | "succeeded" | "failed";
  createdAt: string;
  /** What the money is for. Security deposits never count towards the stay price. */
  concept?: PaymentConcept;
  /** How it was received: cash, transfer, card, stripe, paypal, ota, other. */
  method?: string;
  note?: string;
}
export type PaymentConcept =
  "prepayment" | "payment" | "refund" | "deposit" | "deposit_return";
export interface Task {
  id: string;
  propertyId: string;
  unitId: string | null;
  kind: "housekeeping" | "maintenance";
  title: string;
  status: "pending" | "in_progress" | "completed";
  priority: "normal" | "high";
  assigneeId: string | null;
  version: number;
}
export interface Channel {
  id: string;
  propertyId: string;
  name: string;
  provider: string;
  status: "connected" | "disconnected" | "error";
  syncMode: "ari" | "all";
  ownership: "pms" | "channel";
  mappings: {
    inventoryTypeId: string;
    externalId: string;
    ratePlanId: string;
  }[];
  lastSync: string | null;
  lastError: string | null;
  simulateFailure: boolean;
  version: number;
}
export type JobStatus =
  "queued" | "running" | "review" | "retry" | "completed" | "dead_letter";
export interface MigrationRecord {
  externalId: string;
  kind: "guest" | "reservation" | "inventory" | "rate";
  payload: Record<string, string | number>;
  status: "staged" | "conflict" | "excluded" | "imported";
  reason?: string;
  internalId?: string;
}
export interface Job {
  id: string;
  organizationId: string;
  propertyId: string;
  actorId: string;
  type:
    | "migration"
    | "ical_import"
    | "channel_sync"
    | "report"
    | "automation"
    | "payment";
  status: JobStatus;
  step: number;
  progress: number;
  message: string;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  lockedUntil: string | null;
  lockToken: string | null;
  payload: Record<string, string | number | boolean>;
  records: MigrationRecord[];
  result: string[];
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Audit {
  id: string;
  organizationId: string;
  propertyId: string | null;
  actorId: string;
  action: string;
  entityId: string;
  requestId: string;
  createdAt: string;
  detail: string;
}
export interface Outbox {
  id: string;
  organizationId: string;
  propertyId: string;
  type: string;
  entityId: string;
  createdAt: string;
  processedAt: string | null;
}
export interface Automation {
  id: string;
  propertyId: string;
  name: string;
  trigger:
    "reservation.created" | "reservation.cancelled" | "checkout.completed";
  action: "create_task" | "notify_team";
  enabled: boolean;
}
export interface Draft {
  id: string;
  organizationId: string;
  userId: string;
  step: number;
  data: Record<string, string>;
  updatedAt: string;
}
export interface Session {
  tokenHash: string;
  userId: string;
  expiresAt: string;
  stepUpUntil: string | null;
}
export interface Idempotency {
  key: string;
  organizationId: string;
  actorId: string;
  fingerprint: string;
  result: CommandResult;
  createdAt: string;
}
export interface ExternalIdentity {
  organizationId: string;
  connectionId: string;
  kind: string;
  externalId: string;
  internalId: string;
}
export interface Conversation {
  id: string;
  propertyId: string;
  reservationId: string;
  status: "open" | "archived";
  assigneeId: string | null;
  version: number;
  updatedAt: string;
}
export interface MessageEntry {
  id: string;
  propertyId: string;
  reservationId: string;
  direction: "inbound" | "outbound" | "internal";
  status: "received" | "draft" | "blocked" | "sent" | "recorded" | "cancelled";
  subject: string;
  body: string;
  scheduledAt: string | null;
  failureCode: string | null;
  authorId: string;
  createdAt: string;
  version: number;
}
export interface MessageTemplate {
  id: string;
  propertyId: string;
  name: string;
  locale: string;
  subject: string;
  body: string;
  trigger: "manual" | "booking" | "arrival" | "departure";
  offsetDays: number;
  version: number;
}
export interface MarketObservation {
  id: string;
  propertyId: string;
  date: string;
  observedOn: string;
  source: string;
  market: string;
  currency: string;
  adrMinor: number;
  occupancyBps: number;
  sampleSize: number;
}
export interface State {
  workspacePreferences?: {
    id: string;
    organizationId: string;
    userId: string;
    version: number;
    preferences: WorkspacePreferences;
    updatedAt: string;
  }[];
  icalFeeds?: {
    propertyId: string;
    unitId: string;
    tokenHash: string;
    actorId: string;
  }[];
  icalEvents?: {
    propertyId: string;
    unitId: string;
    calendar: string;
    uid: string;
    sequence: number;
    stamp: string;
    blockId: string;
  }[];
  conversations: Conversation[];
  messageEntries: MessageEntry[];
  messageTemplates: MessageTemplate[];
  marketObservations: MarketObservation[];
  schemaVersion: 2;
  organizations: Organization[];
  users: User[];
  memberships: Membership[];
  properties: Property[];
  inventoryTypes: InventoryType[];
  units: Unit[];
  guests: Guest[];
  reservations: Reservation[];
  blocks: InventoryBlock[];
  ratePlans: RatePlan[];
  rateDays: RateDay[];
  folioItems: FolioItem[];
  payments: Payment[];
  tasks: Task[];
  channels: Channel[];
  jobs: Job[];
  audits: Audit[];
  outbox: Outbox[];
  automations: Automation[];
  drafts: Draft[];
  sessions: Session[];
  credentials?: LocalCredential[];
  idempotency: Idempotency[];
  externalIdentities: ExternalIdentity[];
}
export interface Actor {
  userId: string;
  stepUpUntil: string | null;
}
export interface CommandResult {
  id: string;
  message: string;
  warning?: string;
  secretUrl?: string;
}
export type Snapshot = Omit<
  State,
  "sessions" | "idempotency" | "externalIdentities" | "icalFeeds" | "icalEvents"
> & {
  analyticsComplete?: boolean;
  currentUser: User;
  permissions: Permission[];
  currentOrganizationId: string;
  currentPropertyId: string;
  development: boolean;
  today: string;
};
