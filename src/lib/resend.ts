import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey && process.env.NODE_ENV === 'production') {
  console.warn('[Resend] RESEND_API_KEY is not set. Email sending will fail.');
}

export const resend = new Resend(resendApiKey || 're_dummy_key_for_build');

interface BookingEmailData {
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  currency: string;
  bookingId: number;
  nights: number;
  toEmails?: string[];
}

// Helper para reintentar envíos en caso de errores de conexión intermitentes
async function withRetry<T extends { error: any }>(operation: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const result = await operation();
      if (result.error) {
        // Resend returns an error object on API/network failure instead of throwing
        const msg = result.error.message || '';
        if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch') || (result.error.statusCode && result.error.statusCode >= 500)) {
          throw new Error(msg || 'Resend network error');
        }
      }
      return result;
    } catch (error: any) {
      attempt++;
      console.warn(`[Resend] Attempt ${attempt} failed. Error: ${error?.message || error}`);
      if (attempt >= maxRetries) {
        return { error } as any;
      }
      // Esperar antes de reintentar (backoff exponencial simple)
      await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
    }
  }
  return { error: new Error('Unreachable') } as any;
}

export async function sendBookingConfirmation(data: BookingEmailData) {
  try {
    const currencySymbol = data.currency === 'MXN' ? '$' : data.currency === 'USD' ? 'US$' : '€';
    const formattedPrice = `${currencySymbol}${data.totalPrice.toLocaleString()}`;
    
    const { data: responseData, error } = await withRetry(() => resend.emails.send({
      from: 'Casa Caballo Soñador <reservas@casacaballosonador.com>',
      to: data.toEmails || [data.guestEmail],
      subject: `Confirmación de Reserva #${data.bookingId} — Casa Caballo Soñador`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#F9F7F4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
            <!-- Header -->
            <div style="text-align:center;margin-bottom:40px;">
              <h1 style="font-size:28px;color:#23211F;margin:0;font-weight:300;letter-spacing:0.05em;">Casa Caballo Soñador</h1>
              <div style="width:60px;height:2px;background:#9B7E67;margin:16px auto;"></div>
            </div>
            
            <!-- Content -->
            <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
              <h2 style="font-size:22px;color:#23211F;margin:0 0 8px;font-weight:400;">¡Reserva Confirmada!</h2>
              <p style="color:#666;font-size:14px;margin:0 0 24px;">Hola ${data.guestName}, tu estancia está confirmada.</p>
              
              <div style="border-top:1px solid #eee;padding-top:20px;">
                <table style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="padding:12px 0;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Reserva</td>
                    <td style="padding:12px 0;text-align:right;color:#23211F;font-weight:500;">#${data.bookingId}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Check-in</td>
                    <td style="padding:12px 0;text-align:right;color:#23211F;font-weight:500;">${data.checkIn}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Check-out</td>
                    <td style="padding:12px 0;text-align:right;color:#23211F;font-weight:500;">${data.checkOut}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Noches</td>
                    <td style="padding:12px 0;text-align:right;color:#23211F;font-weight:500;">${data.nights}</td>
                  </tr>
                  <tr style="border-top:2px solid #23211F;">
                    <td style="padding:16px 0;color:#23211F;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Total</td>
                    <td style="padding:16px 0;text-align:right;color:#9B7E67;font-size:24px;font-weight:600;">${formattedPrice} ${data.currency}</td>
                  </tr>
                </table>
              </div>
            </div>

            <!-- Footer -->
            <div style="text-align:center;margin-top:32px;">
              <p style="color:#999;font-size:12px;margin:0;">Casa Caballo Soñador — Chacala, Nayarit, México</p>
              <p style="color:#999;font-size:12px;margin:4px 0 0;">casacaballosonador.com</p>
            </div>
          </div>
        </body>
        </html>
      `,
    }));

    if (error) {
      console.error('[Resend] Error sending booking confirmation:', error);
      return { success: false, error };
    }

    console.log('[Resend] Booking confirmation sent to:', data.guestEmail);
    return { success: true };
  } catch (err) {
    console.error('[Resend] Failed to send booking confirmation:', err);
    return { success: false, error: err };
  }
}

export async function sendInvoiceEmail(data: BookingEmailData, pdfBuffer?: Buffer) {
  try {
    const currencySymbol = data.currency === 'MXN' ? '$' : data.currency === 'USD' ? 'US$' : '€';
    const formattedPrice = `${currencySymbol}${data.totalPrice.toLocaleString()}`;
    
    const attachments = pdfBuffer ? [{
      filename: `Factura-${data.bookingId}.pdf`,
      content: pdfBuffer,
    }] : [];

    const { data: responseData, error } = await withRetry(() => resend.emails.send({
      from: 'Casa Caballo Soñador <facturas@casacaballosonador.com>',
      to: data.toEmails || [data.guestEmail],
      subject: `Factura de Reserva #${data.bookingId} — Casa Caballo Soñador`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background-color:#F9F7F4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
            <div style="text-align:center;margin-bottom:40px;">
              <h1 style="font-size:28px;color:#23211F;margin:0;font-weight:300;">Casa Caballo Soñador</h1>
              <div style="width:60px;height:2px;background:#9B7E67;margin:16px auto;"></div>
            </div>
            <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.06);text-align:center;">
              <h2 style="font-size:22px;color:#23211F;margin:0 0 16px;">Tu Factura</h2>
              <p style="color:#666;font-size:14px;">Adjuntamos tu factura por ${formattedPrice} ${data.currency} correspondiente a la reserva #${data.bookingId}.</p>
            </div>
            <div style="text-align:center;margin-top:32px;">
              <p style="color:#999;font-size:12px;">Casa Caballo Soñador — Chacala, Nayarit, México</p>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments,
    }));

    if (error) {
      console.error('[Resend] Error sending invoice:', error);
      return { success: false, error };
    }

    console.log('[Resend] Invoice sent to:', data.guestEmail);
    return { success: true };
  } catch (err) {
    console.error('[Resend] Failed to send invoice:', err);
    return { success: false, error: err };
  }
}
