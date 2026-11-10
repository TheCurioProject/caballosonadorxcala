import "@fontsource-variable/instrument-sans";
import "@/cala/styles/cala.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { publicCalendar } from "@/cala/infrastructure/public-calendar";
import { DomainError } from "@/cala/domain/shared/errors";
import { PublicAvailability } from "@/cala/features/integrations/public-availability";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Disponibilidad · CALA",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};
export default async function AvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params,
    { lang } = await searchParams;
  const request = new Request("http://localhost/disponibilidad", {
    headers: new Headers(await headers()),
  });
  let calendar: Awaited<ReturnType<typeof publicCalendar>>;
  try {
    calendar = await publicCalendar(request, token);
  } catch (error) {
    if (error instanceof DomainError && error.status === 404) notFound();
    throw error;
  }
  return (
    <PublicAvailability
      calendar={calendar}
      language={lang === "en" ? "en" : "es"}
      fetchedAt={new Date().toISOString()}
    />
  );
}
