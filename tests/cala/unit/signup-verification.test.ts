import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkCode,
  confirmEmail,
  issueCode,
  MAX_ATTEMPTS,
} from "@/lib/cala/signup-verification";

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakeAdmin(initial: any) {
  const state = { user: initial };
  const admin: any = {
    auth: {
      admin: {
        updateUserById: async (_id: string, patch: any) => {
          state.user = {
            ...state.user,
            ...(patch.app_metadata ? { app_metadata: patch.app_metadata } : {}),
            ...(patch.email_confirm ? { email_confirmed_at: "now" } : {}),
          };
          return { data: { user: state.user }, error: null };
        },
      },
    },
  };
  return { admin, state };
}

describe("CALA sign-up email code", () => {
  let lastCode = "";
  beforeEach(() => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-secret");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.spyOn(console, "info").mockImplementation((message: string) => {
      const match = /: (\d{6})$/.exec(message);
      if (match) lastCode = match[1];
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("stores only a hash, enforces cooldown, attempts and expiry", async () => {
    const { admin, state } = fakeAdmin({
      id: "u1",
      email: "a@b.c",
      app_metadata: { provider: "email" },
    });
    await issueCode(admin, state.user, "es");
    expect(lastCode).toMatch(/^\d{6}$/);
    expect(JSON.stringify(state.user.app_metadata)).not.toContain(lastCode);
    await expect(issueCode(admin, state.user, "es")).rejects.toMatchObject({
      code: "CODE_COOLDOWN",
    });

    const wrong = lastCode === "000000" ? "111111" : "000000";
    await expect(checkCode(admin, state.user, wrong)).rejects.toMatchObject({
      code: "CODE_INVALID",
    });
    await expect(checkCode(admin, state.user, lastCode)).resolves.toBeUndefined();

    for (let i = 0; i < MAX_ATTEMPTS; i++)
      await checkCode(admin, state.user, wrong).catch(() => {});
    await expect(checkCode(admin, state.user, lastCode)).rejects.toMatchObject({
      code: "CODE_LOCKED",
    });

    state.user.app_metadata.cala_signup = {
      ...state.user.app_metadata.cala_signup,
      attempts: 0,
      expiresAt: Date.now() - 1,
    };
    await expect(checkCode(admin, state.user, lastCode)).rejects.toMatchObject({
      code: "CODE_EXPIRED",
    });
  });

  it("confirms the email and clears the code, keeping other metadata", async () => {
    const { admin, state } = fakeAdmin({
      id: "u2",
      email: "b@c.d",
      app_metadata: { provider: "email" },
    });
    await issueCode(admin, state.user, "en");
    await checkCode(admin, state.user, lastCode);
    await confirmEmail(admin, state.user);
    expect(state.user.email_confirmed_at).toBe("now");
    expect(state.user.app_metadata.cala_signup).toBeNull();
    expect(state.user.app_metadata.provider).toBe("email");
  });

  it("refuses to run without an email provider in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { admin, state } = fakeAdmin({ id: "u3", email: "c@d.e", app_metadata: {} });
    await expect(issueCode(admin, state.user, "es")).rejects.toMatchObject({
      code: "EMAIL_NOT_CONFIGURED",
    });
  });
});
