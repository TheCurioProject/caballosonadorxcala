import type {
  ConnectionInput,
  ProviderContext,
  CanonicalProperty,
  CanonicalInventory,
  CanonicalGuest,
  CanonicalReservation,
  CanonicalRatePlan,
  CanonicalRate,
  CanonicalRestriction,
  CanonicalAmenity,
  ValidationReport,
  ChangeCaptureHandle,
} from "@/cala/domain/migration/canonical";
import type { MigrationRecord } from "@/cala/domain/model";
export interface ProviderInfo {
  id: string;
  mode: "development" | "production";
  configured: boolean;
}
export interface MigrationProvider {
  info: ProviderInfo;
  connect(input: ConnectionInput): Promise<{ connectionId: string }>;
  discover(
    ctx: ProviderContext,
  ): Promise<{ name: string; categories: string[] }>;
  extract(date: string): Promise<MigrationRecord[]>;
  getProperties(ctx: ProviderContext): AsyncIterable<CanonicalProperty>;
  getInventory(ctx: ProviderContext): AsyncIterable<CanonicalInventory>;
  getGuests(ctx: ProviderContext): AsyncIterable<CanonicalGuest>;
  getReservations(ctx: ProviderContext): AsyncIterable<CanonicalReservation>;
  getRatePlans(ctx: ProviderContext): AsyncIterable<CanonicalRatePlan>;
  getRates(ctx: ProviderContext): AsyncIterable<CanonicalRate>;
  getRestrictions(ctx: ProviderContext): AsyncIterable<CanonicalRestriction>;
  getAmenities(ctx: ProviderContext): AsyncIterable<CanonicalAmenity>;
  validate(ctx: ProviderContext): Promise<ValidationReport>;
  startChangeCapture?(ctx: ProviderContext): Promise<ChangeCaptureHandle>;
  disconnect(ctx: ProviderContext): Promise<void>;
}
export interface DistributionProvider {
  info: ProviderInfo;
  pushARI(input: {
    idempotencyKey: string;
    inventoryTypeIds: string[];
    simulateFailure: boolean;
  }): Promise<{ acknowledgement: string }>;
}
export interface PaymentProvider {
  info: ProviderInfo;
  pay(input: {
    idempotencyKey: string;
    amountMinor: number;
    currency: string;
    simulateFailure: boolean;
  }): Promise<{ externalId: string; status: "succeeded" | "failed" }>;
}
export interface JobScheduler {
  tick(): Promise<boolean>;
}
export interface StorageProvider {
  put(key: string, content: string): Promise<void>;
  get(key: string): Promise<string>;
}
export interface ObservabilityProvider {
  record(event: { operation: string; requestId: string; code?: string }): void;
}

/** A delivery receipt must come from an authenticated provider acknowledgement.
 * Implementations belong on the server; iCal has no messaging capability.
 * See docs/integrations/messaging-contract.md for the activation gates.
 */
export interface MessagingProvider {
  info: ProviderInfo;
  capabilities: {
    nativeMessaging: boolean;
    emailMessaging: boolean;
    inbound: boolean;
    attachments: boolean;
    html: boolean;
  };
  send(input: {
    connectionId: string;
    externalReservationId: string;
    idempotencyKey: string;
    subject: string;
    body: string;
  }): Promise<{ providerMessageId: string; acceptedAt: string }>;
}
