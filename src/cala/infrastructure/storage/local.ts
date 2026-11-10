import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import type { StorageProvider } from "@/cala/application/ports/providers";
import { invariant } from "@/cala/domain/shared/errors";
export class LocalStorageProvider implements StorageProvider {
  constructor(private root: string) {}
  private path(key: string) {
    invariant(
      /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,120}\.(csv|json|txt)$/.test(key),
      "INVALID_STORAGE_KEY",
      "Identificador de archivo inválido.",
    );
    return resolve(this.root, key);
  }
  async put(key: string, content: string) {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, content, { mode: 0o600 });
  }
  async get(key: string) {
    return readFile(this.path(key), "utf8");
  }
}
