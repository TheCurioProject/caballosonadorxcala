import { resolve } from "node:path";
import { LocalPersistenceAdapter } from "./local";
import { emptyState } from "./empty";
import { assertDevelopment } from "@/cala/lib/runtime";
const globalStore = globalThis as typeof globalThis & {
  pmsStore?: LocalPersistenceAdapter;
};
export function persistence() {
  assertDevelopment();
  return (globalStore.pmsStore ??= new LocalPersistenceAdapter(
    resolve(process.env.DEVELOPMENT_DB_PATH ?? ".data/pms.sqlite"),
    emptyState,
    true,
  ));
}
