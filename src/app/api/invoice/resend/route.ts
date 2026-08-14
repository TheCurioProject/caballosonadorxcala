import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendInvoiceEmail } from '@/lib/resend';
import { differenceInDays } from 'date-fns';
import { generateInvoicePDFBuffer } from '@/lib/pdf';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: { property: true, addons: true }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.payment_status !== 'CONFIRMED') {
      return NextResponse.json({ error: 'Booking is not confirmed' }, { status: 400 });
    }

    const nights = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));
    const currency = 'MXN'; // Defaulting to MXN, ideally should be fetched from session or booking

    let pdfBuffer: Buffer | undefined = undefined;
    try {
      const logoPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_official.png');
      const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
      
      pdfBuffer = await generateInvoicePDFBuffer({
        bookingId: booking.id,
        guestName: booking.guestName,
        roomName: booking.property?.name || 'Casa Caballo Soñador',
        checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
        checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
        totalPrice: booking.totalPrice,
        depositPaid: booking.depositPaid || 0,
        depositCurrency: booking.depositCurrency || 'MXN',
        date: new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
        logoBase64: logoBase64,
        addons: booking.addons
      });
    } catch (pdfError) {
      console.error('[Resend Invoice] Failed to generate invoice PDF', pdfError);
      return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }

    const emailData = {
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
      checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
      totalPrice: booking.totalPrice,
      currency,
      bookingId: booking.id,
      nights,
    };

    const emailResult = await sendInvoiceEmail(emailData, pdfBuffer);

    if (!emailResult.success) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[Resend Invoice Error]:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
