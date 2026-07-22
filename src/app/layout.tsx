import type { Metadata, Viewport } from "next";
import { Syne, Cormorant } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { BookingProvider } from "@/context/BookingContext";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { cookies } from 'next/headers';
import { getDictionary } from '@/i18n/dictionaries';
import { DictionaryProvider } from '@/i18n/DictionaryContext';

const syne = Syne({
  subsets: ["latin", "latin-ext"],
  variable: "--font-syne",
});

const cormorant = Cormorant({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  style: ['normal', 'italic'],
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "Casa Caballo Soñador | Hotel Boutique en Chacala",
  description: "Renta Exclusiva de Villa en México: Un Refugio de Paz y Conexión para vacaciones de lujo en la naturaleza.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Use cookie to determine lang for the HTML tag since this layout wraps everything
  const cookieStore = await cookies();
  const lang = (cookieStore.get('NEXT_LOCALE')?.value as 'es' | 'en') || 'es';
  const dict = await getDictionary(lang);

  return (
    <html lang={lang} className={`${syne.variable} ${cormorant.variable}`}>
      <body className="font-sans bg-brand-beige text-brand-dark antialiased selection:bg-brand-terracotta selection:text-brand-beige">
        <DictionaryProvider dict={dict}>
          <BookingProvider>
            <LoadingScreen />
            <Navigation />
            <main className="min-h-screen">
              {children}
            </main>
          </BookingProvider>
        </DictionaryProvider>
      </body>
    </html>
  );
}
