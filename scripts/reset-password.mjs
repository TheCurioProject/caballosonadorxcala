// Genera un link de recuperación de contraseña usando la service_role key
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

const envFile = readFileSync(join(root, '.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').replace(/^"|"$/g, '').trim()]; })
    .filter(([k]) => k)
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: () => null },
});

const email = 'thecurio.dev@hotmail.com';

// Opción A: Generar link de recuperación
const { data, error } = await admin.auth.admin.generateLink({
  type: 'recovery',
  email,
  options: {
    redirectTo: 'http://localhost:3000/cala/',
  },
});

if (error) {
  console.error('❌ Error generando link:', error.message);
  
  // Opción B: Establecer una contraseña temporal conocida
  const tempPassword = 'CalaTemp2024!';
  const { error: updateErr } = await admin.auth.admin.updateUserById(
    '334a4e06-1e74-4911-92f9-3391ad488527',
    { password: tempPassword }
  );
  if (updateErr) {
    console.error('❌ Error actualizando contraseña:', updateErr.message);
  } else {
    console.log('✅ Contraseña temporal establecida');
    console.log('');
    console.log('📧 Email:', email);
    console.log('🔑 Contraseña temporal: ' + tempPassword);
    console.log('');
    console.log('⚠️  Cambia esta contraseña después de entrar al panel.');
  }
} else {
  console.log('✅ Link de recuperación generado:');
  console.log('');
  console.log(data?.properties?.action_link ?? data?.properties?.hashed_token);
  console.log('');
  console.log('👆 Abre ese link en el navegador para establecer tu nueva contraseña.');
  console.log('   Después vuelve al login con tu nueva contraseña.');
}

