import type { Metadata, Viewport } from "next";
import { Syne, Cormorant } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { BookingProvider } from "@/context/BookingContext";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});

const cormorant = Cormorant({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ['normal', 'italic'],
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "Casa del Caballo Soñador | Hotel Boutique en Chacala",
  description: "Renta Exclusiva de Villa en México: Un Refugio de Paz y Conexión para vacaciones de lujo en la naturaleza.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${syne.variable} ${cormorant.variable}`}>
      <body className="font-sans bg-brand-beige text-brand-dark antialiased selection:bg-brand-terracotta selection:text-brand-beige">
        <BookingProvider>
          <LoadingScreen />
          <Navigation />
          <main className="min-h-screen">
            {children}
          </main>
        </BookingProvider>
      </body>
    </html>
  );
}
