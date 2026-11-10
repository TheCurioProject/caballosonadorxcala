import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { syncAllIcalFeeds } from "@/lib/icalSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await syncAllIcalFeeds());
  } catch (error) {
    console.error("[iCal] Sync failed", error);
    return NextResponse.json(
      { error: "Synchronization failed" },
      { status: 500 },
    );
  }
}
