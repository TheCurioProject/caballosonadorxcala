import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['es', 'en', 'de'];
const defaultLocale = 'es';

function getLocale(request: NextRequest) {
  return defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1. Manejo de Auth para /admin
  const adminSession = request.cookies.get('admin_session')?.value;

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    if (!adminSession) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  if (pathname.startsWith('/admin/login')) {
    if (adminSession) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // Si es api o admin o estáticos (imágenes, etc.), saltamos el i18n
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/imagenes') ||
    pathname.startsWith('/uploads') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Manejo de i18n (Locales)
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (!pathnameHasLocale) {
    const locale = request.cookies.get('NEXT_LOCALE')?.value || getLocale(request);
    request.nextUrl.pathname = `/${locale}${pathname === '/' ? '/' : pathname.endsWith('/') ? pathname : pathname + '/'}`;
    const response = NextResponse.redirect(request.nextUrl);
    response.cookies.set('NEXT_LOCALE', locale, { path: '/' });
    return response;
  }

  // Si ya tiene locale en la URL, asegurarnos de que la cookie esté alineada
  const currentLocale = locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`);
  const response = NextResponse.next();
  if (currentLocale && request.cookies.get('NEXT_LOCALE')?.value !== currentLocale) {
    response.cookies.set('NEXT_LOCALE', currentLocale, { path: '/' });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
