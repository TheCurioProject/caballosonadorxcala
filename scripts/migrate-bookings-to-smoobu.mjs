import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { EXPECTED_ACCOUNT_ID, WIDGET_APARTMENT_IDS, SmoobuClient, buildEntry, normalize,
  normalizeDatabaseUrl, markLocalOverlaps, remoteDecision, ledgerDecision, executeEntries, renderConflictReport } from './lib/smoobu-migration.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(root, false);
const privateRoot = path.join(root, '.smoobu-migration');
const args = new Set(process.argv.slice(2));
const supported = ['--audit', '--dry-run', '--apply', '--list-apartments', '--help'];
if ([...args].some(arg => !supported.includes(arg)) || args.size > 1) {
  console.error(`Usa una sola opción: ${supported.join(', ')}.`);
  process.exit(1);
}

async function readJson(filename, fallback) {
  try { return JSON.parse(await fs.readFile(filename, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

async function writeJson(filename, data) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx', flush: true });
  await fs.rename(temporary, filename);
}

async function getPrivateRoot() {
  await fs.mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(privateRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('El directorio privado de migración no es válido.');
  await fs.chmod(privateRoot, 0o700);
}

function getClient() {
  return new SmoobuClient({ key: process.env.SMOOBU_API_KEY, secret: process.env.SMOOBU_API_SECRET });
}

async function getDestination(client, property, listOnly = false) {
  const user = await client.request('/api/me');
  if (Number(user.id) !== EXPECTED_ACCOUNT_ID) throw new Error('La clave pertenece a otra cuenta de Smoobu; no se continuará.');
  const response = await client.request('/api/apartments');
  if (!Array.isArray(response.apartments)) throw new Error('La lista de alojamientos de Smoobu no es válida.');
  const apartments = [];
  for (const apartment of response.apartments.filter(a => WIDGET_APARTMENT_IDS.includes(Number(a.id)))) {
    const details = await client.request(`/api/apartments/${apartment.id}`);
    apartments.push({ id: Number(apartment.id), name: apartment.name, capacity: Number(details.rooms?.maxOccupancy), currency: details.currency });
  }
  if (listOnly) return apartments;
  const configured = process.env.SMOOBU_APARTMENT_ID?.trim();
  const fullHouses = apartments.filter(a => a.capacity === 12);
  const exact = fullHouses.filter(a => normalize(a.name) === normalize(property.name));
  const target = configured
    ? apartments.find(a => a.id === Number(configured))
    : exact.length === 1 ? exact[0] : fullHouses.length === 1 ? fullHouses[0] : null;
  if (!target || target.capacity !== 12) throw new Error('No se pudo identificar una única casa para 12 personas. Configura SMOOBU_APARTMENT_ID después de listar alojamientos.');
  if (target.currency !== 'MXN') throw new Error('La moneda de destino no es MXN; no se convertirán importes automáticamente.');
  return target;
}

async function main() {
  if (args.has('--help')) {
    console.log('npm run smoobu:migrate -- [--audit|--dry-run|--list-apartments|--apply]');
    console.log('Sin opción: revisión sin importar. Acceso: SMOOBU_API_KEY y SMOOBU_API_SECRET en .env.local.');
    return;
  }
  if (args.has('--list-apartments')) {
    console.log(JSON.stringify(await getDestination(getClient(), null, true), null, 2));
    return;
  }
  await getPrivateRoot();
  let lock, prisma;
  const lockPath = path.join(privateRoot, 'migration.lock');
  const applying = args.has('--apply');
  try {
    if (applying) {
      try { lock = await fs.open(lockPath, 'wx', 0o600); }
      catch (error) { if (error.code === 'EEXIST') throw new Error('Hay otra importación o un cierre interrumpido; revisa migration.lock antes de continuar.'); throw error; }
      await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    }
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient({ datasources: { db: { url: normalizeDatabaseUrl(process.env.DATABASE_URL) } } });
    const properties = await prisma.property.findMany({ select: { id: true, name: true } });
    const sourceId = process.env.SMOOBU_SOURCE_PROPERTY_ID?.trim();
    const property = sourceId ? properties.find(p => p.id === Number(sourceId)) : properties.length === 1 ? properties[0] : null;
    if (!property) throw new Error('Configura SMOOBU_SOURCE_PROPERTY_ID; no hay un único alojamiento local.');
    const [bookings, blocks] = await Promise.all([
      prisma.booking.findMany({ where: { propertyId: property.id }, include: { addons: true }, orderBy: { id: 'asc' } }),
      prisma.blockedDate.findMany({ where: { propertyId: property.id }, orderBy: { id: 'asc' } }),
    ]);
    const runDirectory = path.join(privateRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
    await fs.mkdir(runDirectory, { mode: 0o700 });
    await writeJson(path.join(runDirectory, 'source-backup.json'), { exportedAt: new Date().toISOString(), property, bookings, blocks });

    const overridesPath = path.join(privateRoot, 'overrides.json');
    const overrides = await readJson(overridesPath, {});
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)
        || Object.keys(overrides).some(id => !bookings.some(b => String(b.id) === id))) throw new Error('overrides.json contiene identificadores o un formato no válidos.');
    if (!Object.keys(overrides).length) {
      try {
        await fs.writeFile(overridesPath, JSON.stringify(Object.fromEntries(bookings.filter(b => b.payment_status === 'CONFIRMED' && ['MANUAL', 'WEBSITE'].includes(b.origin))
          .map(b => [b.id, { adults: null, children: null, paid: null }])), null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      } catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    const configured = !!process.env.SMOOBU_API_KEY && !!process.env.SMOOBU_API_SECRET;
    const remoteEnabled = configured && !args.has('--audit');
    const client = remoteEnabled ? getClient() : null;
    const target = client ? await getDestination(client, property) : null;
    const remoteBookings = client ? await client.getBookings() : [];
    if (client) await writeJson(path.join(runDirectory, 'smoobu-backup.json'), remoteBookings);
    const ledgerPath = path.join(privateRoot, 'ledger.json');
    const ledger = await readJson(ledgerPath, {});
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) throw new Error('El registro de importación no es válido.');
    const entries = markLocalOverlaps(bookings.map(booking => {
      const entry = buildEntry(booking, { apartmentId: target?.id, override: overrides[booking.id] ?? {} });
      return client ? ledgerDecision(remoteDecision(entry, remoteBookings, target.id), ledger[entry.marker]) : entry;
    }));
    const summary = Object.fromEntries(['ready', 'existing', 'review', 'skipped'].map(state => [state, entries.filter(e => e.state === state).length]));
    const report = { mode: client ? applying ? 'apply' : 'dry-run' : 'local-audit',
      source: property, target, expectedAccountId: EXPECTED_ACCOUNT_ID,
      remoteChecked: !!client, summary, entries,
      blocks: { total: blocks.length, manual: blocks.filter(b => b.source === 'manual').length, migrated: false },
      missingSettings: configured ? [] : ['SMOOBU_API_KEY', 'SMOOBU_API_SECRET'].filter(name => !process.env[name]),
      results: [],
    };
    const planPath = path.join(runDirectory, 'plan.json');
    await writeJson(planPath, report);
    const reviewPath = path.join(runDirectory, 'review.html');
    await fs.writeFile(reviewPath, renderConflictReport(report, remoteBookings), { mode: 0o600, flag: 'wx' });
    console.log(JSON.stringify({ mode: report.mode, source: property, target, remoteChecked: report.remoteChecked,
      summary, calendarBlocks: report.blocks, missingSettings: report.missingSettings, report: path.relative(root, planPath), review: path.relative(root, reviewPath) }, null, 2));
    if (!applying) return;
    if (!client) throw new Error('La revisión local está guardada. Falta configurar el acceso API de Smoobu para importar.');
    await executeEntries(entries, { client, ledger,
      saveLedger: value => writeJson(ledgerPath, value),
      loadSource: id => prisma.booking.findUnique({ where: { id }, include: { addons: true } }),
      onProgress: async result => {
        report.results.push({ bookingId: result.bookingId, remoteId: result.remoteId, state: result.state });
        await writeJson(planPath, report);
        console.log(JSON.stringify({ bookingId: result.bookingId, remoteId: result.remoteId, state: result.state }));
      },
    });
    console.log('Importación terminada. Los registros originales permanecen en la base de datos.');
  } finally {
    try { if (prisma) await prisma.$disconnect(); }
    finally { if (lock) { await lock.close(); await fs.unlink(lockPath); } }
  }
}

main().catch(error => {
  console.error(error.name?.startsWith('Prisma') ? `No se pudo consultar la base de datos (${error.code || error.name}).` : error.message);
  process.exitCode = 1;
});
