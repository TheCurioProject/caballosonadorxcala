import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendInvoiceEmail } from '@/lib/resend';
import { differenceInDays } from 'date-fns';
import { generateInvoicePDFBuffer } from '@/lib/pdf';
import fs from 'fs';
import path from 'path';

// ─── Rate limiter for invoice resend (prevent enumeration/spam) ───
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // max 3 resend attempts per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateLimitMap.size > 10000) {
    for (const [key, value] of rateLimitMap) if (value.resetAt <= now) rateLimitMap.delete(key);
    if (rateLimitMap.size > 10000) return true;
  }
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export async function POST(req: Request) {
  try {
    // Rate limiting to prevent enumeration attacks
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('x-real-ip') 
      || 'unknown';
    if (isRateLimited(clientIp)) {
      return NextResponse.json({ error: 'Demasiados intentos. Espera un momento.' }, { status: 429 });
    }

    const { bookingId, guestEmail } = await req.json();

    if (!Number.isSafeInteger(Number(bookingId)) || Number(bookingId) < 1 || typeof guestEmail !== 'string' || !guestEmail.trim()) {
      return NextResponse.json({ error: 'Falta el ID de la reserva' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: { property: true, addons: true }
    });

    if (!booking) {
      // Return generic error to prevent ID enumeration
      return NextResponse.json({ error: 'Reserva no encontrada o datos incorrectos' }, { status: 404 });
    }

    // VULN-06 FIX: Verify that the requester is the booking owner via email match
    // This prevents arbitrary users from requesting invoices for bookings they don't own
    if (guestEmail.trim().toLowerCase() !== booking.guestEmail.toLowerCase()) {
      return NextResponse.json({ error: 'Reserva no encontrada o datos incorrectos' }, { status: 404 });
    }

    if (!['CONFIRMED', 'PAID'].includes(booking.payment_status)) {
      return NextResponse.json({ error: 'El pago aún está en proceso de validación por Stripe. Intenta de nuevo en unos segundos.' }, { status: 400 });
    }

    const nights = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));
    const currency = 'MXN';

    let pdfBuffer: Buffer | undefined = undefined;
    try {
      const logoPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_official.png');
      const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
      
      pdfBuffer = await generateInvoicePDFBuffer({
        bookingId: booking.id,
        guestName: booking.guestName,
        roomName: booking.property?.name || 'Casa Caballo Soñador',
        checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { timeZone: 'UTC' }),
        checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { timeZone: 'UTC' }),
        totalPrice: booking.totalPrice,
        depositPaid: booking.depositPaid || 0,
        depositCurrency: booking.depositCurrency || 'MXN',
        date: new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
        logoBase64: logoBase64,
        addons: booking.addons
      });
    } catch (pdfError) {
      console.error('[Resend Invoice] Failed to generate invoice PDF', pdfError);
      return NextResponse.json({ error: 'Error interno: No se pudo generar el PDF' }, { status: 500 });
    }

    const emailData = {
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }),
      checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }),
      totalPrice: booking.totalPrice,
      currency,
      bookingId: booking.id,
      nights,
    };

    const emailResult = await sendInvoiceEmail(emailData, pdfBuffer);

    if (!emailResult.success) {
      return NextResponse.json({ error: 'El sistema de correos falló. ¿Falta la API Key de Resend?' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[Resend Invoice Error]:', err);
    return NextResponse.json({ error: 'Error del servidor al intentar reenviar.' }, { status: 500 });
  }
}
