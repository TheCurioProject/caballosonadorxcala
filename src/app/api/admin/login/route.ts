import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { encrypt } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Faltan credenciales' }, { status: 400 });
    }

    // Buscamos al usuario en la BD (usaremos email como username)
    let user = await prisma.adminUser.findUnique({
      where: { email: username },
    });

    // Si no hay usuarios y es admin/caballosonador8, lo creamos para inicializar el sistema
    if (!user && username === 'admin') {
      const allUsers = await prisma.adminUser.count();
      if (allUsers === 0) {
        const hash = await bcrypt.hash('caballosonador8', 10);
        user = await prisma.adminUser.create({
          data: {
            email: 'admin',
            passwordHash: hash,
            name: 'Administrador Principal',
            role: 'SUPERADMIN',
          },
        });
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // Crear token JWT
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const session = await encrypt({ user: { id: user.id, email: user.email, role: user.role } });

    const response = NextResponse.json({ success: true }, { status: 200 });
    
    // Set cookie
    response.cookies.set({
      name: 'admin_session',
      value: session,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expires,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
