// Diagnóstico de login — prueba signin directamente
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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', SUPABASE_URL);
console.log('Publishable key (primeros 20):', PUBLISHABLE_KEY?.slice(0, 20));
console.log('');

// 1. Intentar con publishable key (lo que hace el browser)
const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: () => null },
});

// Intentar signin (pedirá la contraseña como argumento)
const email = 'thecurio.dev@hotmail.com';
const password = process.argv[2];

if (!password) {
  console.log('Uso: node scripts/diag-login.mjs TU_CONTRASEÑA');
  console.log('');
  console.log('Por ahora verificando que la conexión a Supabase Auth funciona...');
  
  // Ver si podemos hacer cualquier petición auth
  const { data, error } = await client.auth.getSession();
  console.log('getSession error:', error?.message ?? 'ninguno');
  console.log('getSession data:', JSON.stringify(data));
  
  // Intentar con una contraseña incorrecta para ver el tipo de error
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: 'dummy_wrong_password_12345',
  });
  console.log('\nError con contraseña incorrecta:', signInErr?.message, '| código:', signInErr?.code, '| status:', signInErr?.status);
  
  process.exit(0);
}

console.log(`Intentando login con ${email}...`);
const { data, error } = await client.auth.signInWithPassword({ email, password });
if (error) {
  console.log('❌ Error:', error.message, '| código:', error.code, '| status:', error.status);
} else {
  console.log('✅ Login exitoso!');
  console.log('Usuario:', data.user?.email);
  console.log('Session expires:', data.session?.expires_at);
}

