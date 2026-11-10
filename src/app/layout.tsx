import type { Metadata, Viewport } from "next";
import { Syne, Cormorant } from "next/font/google";
import "./globals.css";
import {SiteChrome} from '@/components/SiteChrome';
import { headers } from 'next/headers';
import { getDictionary } from '@/i18n/dictionaries';

const syne = Syne({
  subsets: ["latin", "latin-ext"],
  variable: "--font-syne",
  display: 'swap',
});

const cormorant = Cormorant({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  style: ['normal', 'italic'],
  variable: "--font-cormorant",
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: "Casa Caballo Soñador | Hotel Boutique en Chacala, Nayarit",
    template: "%s | Casa Caballo Soñador",
  },
  description: "Renta Exclusiva de Villa en México: Un Refugio de Paz y Conexión para vacaciones de lujo en la naturaleza. Chacala, Nayarit.",
  metadataBase: new URL('https://casadelcaballosonador.com'),
  authors: [{ name: 'Casa Caballo Soñador' }],
  creator: 'The Curio Agency',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F9F7F4' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0908' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Use cookie to determine lang for the HTML tag since this layout wraps everything
  const requestHeaders = await headers();
  const isCala = /^(\/admin(?:\/|$)|\/cala\/disponibilidad\/)/.test(requestHeaders.get("x-app-pathname") || "");
  const requestedLocale = requestHeaders.get('x-app-locale');
  const lang = requestedLocale === 'en' ? 'en' : 'es';
  const dict = await getDictionary(lang);

  return (
    <html lang={lang} className={`${syne.variable} ${cormorant.variable}`}>
      <head>
        {/* Preconnect to external resources for faster loading */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="preconnect" href="https://maps.googleapis.com" />
        <link rel="dns-prefetch" href="https://maps.googleapis.com" />
        <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={isCala ? "cala-admin" : "font-sans bg-brand-beige text-brand-dark antialiased selection:bg-brand-terracotta selection:text-brand-beige"}>
        <SiteChrome dict={dict}>{children}</SiteChrome>
      </body>
    </html>
  );
}
