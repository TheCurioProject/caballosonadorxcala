import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptInvite,
  checkInvite,
  INVITE_TTL_MS,
  issueInvite,
  parseInvite,
  sendInviteEmail,
} from "@/lib/cala/team-invitation";

/* eslint-disable @typescript-eslint/no-explicit-any */
const USER_ID = "6a7b9f46-d046-4126-99d4-35b4b2314775";
function fakeAdmin(initial: any) {
  const state = { user: initial, password: "" };
  const admin: any = {
    auth: {
      admin: {
        getUserById: async (id: string) =>
          id === state.user.id
            ? { data: { user: state.user }, error: null }
            : { data: { user: null }, error: { message: "not found" } },
        updateUserById: async (_id: string, patch: any) => {
          if (patch.password) state.password = patch.password;
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

describe("CALA team invitation link", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("issues a one-time link that sets the password and confirms the email", async () => {
    const { admin, state } = fakeAdmin({
      id: USER_ID,
      email: "new@team.test",
      app_metadata: { provider: "email" },
    });
    const link = await issueInvite(admin, state.user, "https://example.test");
    const url = new URL(link);
    expect(url.pathname).toBe("/admin/login/");
    const invite = url.searchParams.get("invite")!;
    expect(parseInvite(invite)?.userId).toBe(USER_ID);
    // Only the hash is stored.
    expect(JSON.stringify(state.user.app_metadata)).not.toContain(
      invite.split(".")[1],
    );

    const user = await checkInvite(admin, invite);
    await acceptInvite(admin, user, "nueva-clave-123");
    expect(state.password).toBe("nueva-clave-123");
    expect(state.user.email_confirmed_at).toBe("now");
    // Burned: the same link can't be used twice.
    await expect(checkInvite(admin, invite)).rejects.toMatchObject({
      code: "INVITE_INVALID",
    });
  });

  it("rejects tampered, foreign and expired links", async () => {
    const { admin, state } = fakeAdmin({
      id: USER_ID,
      email: "new@team.test",
      app_metadata: {},
    });
    const invite = new URL(
      await issueInvite(admin, state.user, "https://example.test"),
    ).searchParams.get("invite")!;
    const [id, token] = invite.split(".");
    const tampered = `${id}.${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    await expect(checkInvite(admin, tampered)).rejects.toMatchObject({
      code: "INVITE_INVALID",
    });
    await expect(
      checkInvite(admin, `00000000-0000-0000-0000-000000000000.${token}`),
    ).rejects.toMatchObject({ code: "INVITE_INVALID" });
    await expect(checkInvite(admin, "garbage")).rejects.toMatchObject({
      code: "INVITE_INVALID",
    });

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + INVITE_TTL_MS + 1000);
    await expect(checkInvite(admin, invite)).rejects.toMatchObject({
      code: "INVITE_EXPIRED",
    });
  });

  it("reports (not throws) when the email can't be sent", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(
      sendInviteEmail({
        to: "new@team.test",
        name: "Ana",
        inviter: "Cortni",
        link: "https://example.test/admin/login/?invite=x",
        locale: "es",
      }),
    ).resolves.toBe(false);
  });
});
