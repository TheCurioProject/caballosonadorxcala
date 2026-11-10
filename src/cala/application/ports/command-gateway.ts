import type { CommandResult } from "@/cala/domain/model";
/** Async boundary shared by HTTP composition roots; production runs invariants inside PostgreSQL RPC. */
export interface CommandGateway {
  execute(input: unknown, idempotencyKey: string): Promise<CommandResult>;
}
