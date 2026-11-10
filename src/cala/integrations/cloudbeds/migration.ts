import type { MigrationProvider } from "@/cala/application/ports/providers";
import type { MigrationRecord } from "@/cala/domain/model";
import { DomainError } from "@/cala/domain/shared/errors";
/** Disabled until official API access, scopes, endpoints and contract tests are configured. No guessed network calls. */
export class CloudbedsMigrationProvider implements MigrationProvider {
  info = { id: "cloudbeds", mode: "production" as const, configured: false };
  private unavailable(): never {
    throw new DomainError(
      "PROVIDER_NOT_CONFIGURED",
      "Cloudbeds requiere acceso API verificado, configuración y pruebas de contrato.",
      503,
    );
  }
  async connect(): Promise<{ connectionId: string }> {
    return this.unavailable();
  }
  async discover(): Promise<{ name: string; categories: string[] }> {
    return this.unavailable();
  }
  async extract(): Promise<MigrationRecord[]> {
    return this.unavailable();
  }
  async *getProperties(): ReturnType<MigrationProvider["getProperties"]> {
    this.unavailable();
  }
  async *getInventory(): ReturnType<MigrationProvider["getInventory"]> {
    this.unavailable();
  }
  async *getGuests(): ReturnType<MigrationProvider["getGuests"]> {
    this.unavailable();
  }
  async *getReservations(): ReturnType<MigrationProvider["getReservations"]> {
    this.unavailable();
  }
  async *getRatePlans(): ReturnType<MigrationProvider["getRatePlans"]> {
    this.unavailable();
  }
  async *getRates(): ReturnType<MigrationProvider["getRates"]> {
    this.unavailable();
  }
  async *getRestrictions(): ReturnType<MigrationProvider["getRestrictions"]> {
    this.unavailable();
  }
  async *getAmenities(): ReturnType<MigrationProvider["getAmenities"]> {
    this.unavailable();
  }
  async validate(): ReturnType<MigrationProvider["validate"]> {
    return this.unavailable();
  }
  async disconnect(): Promise<void> {
    return this.unavailable();
  }
}
