// Script temporal para conectar a Supabase con service_role key
// Ejecutar desde la raíz del proyecto: node scripts/fix-user.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

// Lee el .env.local manualmente
const envFile = readFileSync(join(root, '.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').replace(/^"|"$/g, '').trim()]; })
    .filter(([k]) => k)
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY no está configurada en .env.local');
  console.error('   Obtén la clave en: https://supabase.com/dashboard/project/ryhdnmgelkjesydewcvo/settings/api');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: () => null },
});

const ORG_ID = env.CALA_ORGANIZATION_ID;

console.log('🔍 Listando usuarios en Supabase Auth...');
const { data: { users }, error } = await admin.auth.admin.listUsers();
if (error) { console.error('❌ Error:', error.message); process.exit(1); }

console.log(`\nEncontrados ${users.length} usuarios:\n`);
for (const u of users) {
  const confirmed = u.email_confirmed_at ? '✅ confirmado' : '❌ SIN CONFIRMAR';
  console.log(`  - ${u.email} | ${confirmed} | id: ${u.id}`);
}

console.log('\n🔧 Verificando membresías en organization_members...');
const { data: members, error: mErr } = await admin
  .from('organization_members')
  .select('user_id, status, role_id')
  .eq('organization_id', ORG_ID);
if (mErr) { console.error('❌ Error leyendo org_members:', mErr.message); process.exit(1); }

const memberIds = new Set((members || []).map(m => m.user_id));
console.log(`\nMiembros actuales de la organización: ${members?.length ?? 0}`);

// Fix: confirmar emails y agregar a org_members si falta
const { data: ownerRole } = await admin.from('roles').select('id').eq('key', 'owner').is('organization_id', null).maybeSingle();
if (!ownerRole) { console.error('❌ No se encontró el rol owner'); process.exit(1); }

let fixed = 0;
for (const u of users) {
  // Confirmar email si no está confirmado
  if (!u.email_confirmed_at) {
    console.log(`\n📧 Confirmando email de ${u.email}...`);
    const { error: confErr } = await admin.auth.admin.updateUserById(u.id, { email_confirm: true });
    if (confErr) console.error(`  ❌ Error: ${confErr.message}`);
    else { console.log('  ✅ Email confirmado'); fixed++; }
  }

  // Agregar a org_members si no está
  if (!memberIds.has(u.id)) {
    console.log(`\n👤 Agregando ${u.email} a organization_members como owner...`);
    const { error: insErr } = await admin.from('organization_members').insert({
      organization_id: ORG_ID,
      user_id: u.id,
      role_id: ownerRole.id,
      status: 'active',
      all_properties: true,
    });
    if (insErr) console.error(`  ❌ Error: ${insErr.message}`);
    else { console.log('  ✅ Agregado como owner'); fixed++; }
  }
}

if (fixed === 0) {
  console.log('\n✅ Todo ya está configurado correctamente. Si el login falla, verifica la contraseña.');
} else {
  console.log(`\n✅ Se corrigieron ${fixed} problema(s). Ya puedes iniciar sesión.`);
}

