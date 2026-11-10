export interface ProviderContext {
  connectionId: string;
  externalPropertyId: string;
  date: string;
  cursor?: string;
}
export interface ConnectionInput {
  organizationId: string;
  credentialReference?: string;
}
export interface CanonicalEnvelope<T> {
  externalId: string;
  externalUpdatedAt?: string;
  fingerprint: string;
  data: T;
}
export type CanonicalProperty = CanonicalEnvelope<{
  name: string;
  timezone: string;
  currency: string;
}>;
export type CanonicalInventory = CanonicalEnvelope<{
  name: string;
  maxOccupancy: number;
  baseRateMinor: number;
}>;
export type CanonicalGuest = CanonicalEnvelope<{
  firstName: string;
  lastName: string;
  email: string;
}>;
export type CanonicalReservation = CanonicalEnvelope<{
  guestExternalId: string;
  inventoryExternalId: string;
  arrival: string;
  departure: string;
  adults: number;
}>;
export type CanonicalRatePlan = CanonicalEnvelope<{ name: string }>;
export type CanonicalRate = CanonicalEnvelope<{
  inventoryExternalId: string;
  date: string;
  amountMinor: number;
}>;
export type CanonicalRestriction = CanonicalEnvelope<{
  inventoryExternalId: string;
  date: string;
  minStay: number;
  maxStay: number;
  closed: boolean;
  cta: boolean;
  ctd: boolean;
}>;
export type CanonicalAmenity = CanonicalEnvelope<{ name: string }>;
export interface ValidationReport {
  valid: boolean;
  issues: { externalId: string; code: string; message: string }[];
}
export interface ChangeCaptureHandle {
  id: string;
  mode: "polling" | "webhook";
}
