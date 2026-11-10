"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Navigation from "@/components/Navigation";
import { BookingProvider } from "@/context/BookingContext";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { DictionaryProvider } from "@/i18n/DictionaryContext";
import type { getDictionary } from "@/i18n/dictionaries";
const publicClasses =
  "font-sans bg-brand-beige text-brand-dark antialiased selection:bg-brand-terracotta selection:text-brand-beige";
/** Root layouts persist on client navigation; switch chrome and body styles with the actual route. */
export function SiteChrome({
  children,
  dict,
}: {
  children: ReactNode;
  dict: Awaited<ReturnType<typeof getDictionary>>;
}) {
  const pathname = usePathname();
  const isCala = /^(\/admin(?:\/|$)|\/cala\/disponibilidad\/)/.test(pathname);
  const documentBoundary = useRef(isCala);
  useLayoutEffect(() => {
    // CSP is a document header. Crossing between the public site and the private panel
    // needs a new document even when a Next Link starts the navigation.
    if (documentBoundary.current !== isCala) {
      window.location.replace(window.location.href);
      return;
    }
    document.body.className = isCala ? "cala-admin" : publicClasses;
  }, [isCala]);
  if (isCala) return children;
  return (
    <DictionaryProvider dict={dict}>
      <BookingProvider>
        <LoadingScreen />
        <Navigation />
        <main className="min-h-screen">{children}</main>
        <CookieConsent />
      </BookingProvider>
    </DictionaryProvider>
  );
}
