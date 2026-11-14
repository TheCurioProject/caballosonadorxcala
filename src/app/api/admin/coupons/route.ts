import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { CouponError, couponInput, couponsReady, deleteCoupon, listCoupons, saveCoupon } from '@/lib/coupons.server';

export const dynamic = 'force-dynamic';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const pending = () => NextResponse.json({ error: 'Los cupones aún no están activados en la base de datos.', code: 'COUPONS_PENDING' }, { status: 503 });

export async function GET() {
  if (!(await getSession())) return unauthorized();
  try {
    if (!(await couponsReady())) return pending();
    return NextResponse.json({ coupons: await listCoupons(), stripe: Boolean(process.env.STRIPE_SECRET_KEY?.trim()) });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await getSession())) return unauthorized();
  try {
    if (!(await couponsReady())) return pending();
    const parsed = couponInput.safeParse(await req.json());
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? '');
      const message = field === 'code' ? 'El código debe tener de 3 a 32 letras o números (también - y _), sin espacios.'
        : field === 'value' ? 'Escribe un descuento válido (el porcentaje va de 1 a 100).'
        : field === 'validUntil' ? 'La fecha final no puede ser anterior a la inicial.'
        : 'Revisa los datos del cupón.';
      return NextResponse.json({ error: message, field }, { status: 400 });
    }
    return NextResponse.json(await saveCoupon(parsed.data));
  } catch (error) {
    if (error instanceof CouponError) {
      if (error.reason === 'DUPLICATE_CODE') return NextResponse.json({ error: 'Ya existe un cupón con ese código.', field: 'code' }, { status: 409 });
      if (error.reason === 'NOT_FOUND') return NextResponse.json({ error: 'Ese cupón ya no existe. Recarga la lista.' }, { status: 404 });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    console.error('Error saving coupon:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await getSession())) return unauthorized();
  try {
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    await deleteCoupon(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
