import type { Actor } from "@/cala/domain/model";
export interface AuthAdapter {
  resolve(token: string): Actor | null;
  signIn(userId: string): string;
  signOut(token: string): void;
  stepUp(token: string): void;
}
