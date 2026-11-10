import type { State } from "@/cala/domain/model";
/** Local unit-of-work contract. Production repositories/RPC provide the same use cases without exposing whole-state snapshots. */
export interface PersistenceAdapter {
  read(): State;
  transaction<T>(work: (state: State) => T): T;
  close(): void;
}
