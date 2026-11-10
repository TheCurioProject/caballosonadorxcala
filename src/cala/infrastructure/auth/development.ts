import {
  randomBytes,
  randomUUID,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { PersistenceAdapter } from "@/cala/application/ports/persistence";
import type { AuthAdapter } from "@/cala/application/ports/auth";
import { invariant } from "@/cala/domain/shared/errors";
import { assertDevelopment } from "@/cala/lib/runtime";
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const passwordHash = (password: string, salt: string) =>
  scryptSync(password, salt, 64).toString("hex");
export class DevelopmentAuthAdapter implements AuthAdapter {
  constructor(private store: PersistenceAdapter) {}
  resolve(token: string) {
    assertDevelopment();
    const s = this.store
      .read()
      .sessions.find(
        (s) =>
          s.tokenHash === hash(token) && s.expiresAt > new Date().toISOString(),
      );
    return s ? { userId: s.userId, stepUpUntil: s.stepUpUntil } : null;
  }
  signIn(userId: string) {
    assertDevelopment();
    const token = randomBytes(32).toString("hex");
    this.store.transaction((s) => {
      invariant(
        s.users.some((u) => u.id === userId),
        "UNKNOWN_USER",
        "Usuario no disponible.",
      );
      s.sessions = s.sessions.filter(
        (x) => x.expiresAt > new Date().toISOString(),
      );
      s.sessions.push({
        tokenHash: hash(token),
        userId,
        expiresAt: new Date(Date.now() + 8 * 3600000).toISOString(),
        stepUpUntil: null,
      });
    });
    return token;
  }
  signUp(name: string, email: string, password: string) {
    assertDevelopment();
    const normalizedEmail = email.trim().toLowerCase();
    const userId = randomUUID();
    const salt = randomBytes(16).toString("hex");
    this.store.transaction((s) => {
      invariant(
        !s.users.some((user) => user.email.toLowerCase() === normalizedEmail),
        "EMAIL_IN_USE",
        "Ya existe una cuenta con este correo.",
        409,
      );
      s.users.push({
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        assistantCompleted: false,
      });
      (s.credentials ??= []).push({
        userId,
        salt,
        passwordHash: passwordHash(password, salt),
      });
    });
    return { userId, token: this.signIn(userId) };
  }
  signInWithPassword(email: string, password: string) {
    assertDevelopment();
    const state = this.store.read();
    const user = state.users.find(
      (candidate) =>
        candidate.email.toLowerCase() === email.trim().toLowerCase(),
    );
    const credential = state.credentials?.find(
      (candidate) => candidate.userId === user?.id,
    );
    const actual = credential
      ? Buffer.from(passwordHash(password, credential.salt), "hex")
      : Buffer.alloc(64);
    const expected = credential
      ? Buffer.from(credential.passwordHash, "hex")
      : Buffer.alloc(64, 1);
    invariant(
      user && credential && timingSafeEqual(actual, expected),
      "INVALID_CREDENTIALS",
      "El correo o la contraseña no coinciden.",
      401,
    );
    return { userId: user.id, token: this.signIn(user.id) };
  }
  completeAssistant(userId: string) {
    this.store.transaction((s) => {
      const user = s.users.find((candidate) => candidate.id === userId);
      invariant(user, "UNKNOWN_USER", "Usuario no disponible.", 404);
      user.assistantCompleted = true;
    });
  }
  signOut(token: string) {
    this.store.transaction((s) => {
      s.sessions = s.sessions.filter((x) => x.tokenHash !== hash(token));
    });
  }
  stepUp(token: string) {
    assertDevelopment();
    this.store.transaction((s) => {
      const session = s.sessions.find(
        (x) =>
          x.tokenHash === hash(token) && x.expiresAt > new Date().toISOString(),
      );
      invariant(session, "UNAUTHORIZED", "Inicia sesión.", 401);
      session.stepUpUntil = new Date(Date.now() + 5 * 60000).toISOString();
    });
  }
}
