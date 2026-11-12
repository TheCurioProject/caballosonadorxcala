import { NextResponse } from "next/server";
import { Resend } from "resend";
import { mailSetup, receiveEmail } from "@/lib/cala/connectors/mail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Resend webhook (`email.received`) for the CALA relay addresses. The webhook
 * and its signing secret are created by the message assistant.
 */
export async function POST(request: Request) {
  const { secret } = await mailSetup();
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const payload = await request.text();
  let event;
  try {
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  try {
    if (event.type === "email.received") await receiveEmail(event.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[inbound-email]", error);
    // 500 makes Resend retry later.
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
