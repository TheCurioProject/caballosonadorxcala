import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const prismaClientSingleton = () => {
  const dbUrl = process.env.DATABASE_URL || '';
  
  if (!dbUrl) {
    console.warn('[Prisma] DATABASE_URL is not set. Using dummy adapter for build phase.');
    const adapter = new PrismaMariaDb('mariadb://user:pass@localhost:3306/db');
    return new PrismaClient({ adapter });
  }

  // Clean the URL: fix common formatting issues
  let cleanUrl = dbUrl;
  cleanUrl = cleanUrl.replace(/@https?:\/\//, '@');
  cleanUrl = cleanUrl.replace(/@www\./, '@');
  cleanUrl = cleanUrl.replace(/\/:(\d+)/, ':$1');
  cleanUrl = cleanUrl.replace(/^mysql:\/\//, 'mariadb://');

  // For Vercel Serverless + Hostgator shared hosting, we explicitly set connectionLimit to 1.
  // We append it to the query string because mariadb creates the pool internally from the string.
  const separator = cleanUrl.includes('?') ? '&' : '?';
  // Remove existing connection_limit if any
  cleanUrl = cleanUrl.replace(/([?&])connection_limit=\d+&?/, '$1');
  cleanUrl = cleanUrl.replace(/([?&])connectionLimit=\d+&?/, '$1');
  
  cleanUrl += `${cleanUrl.includes('?') ? '&' : '?'}connectionLimit=1&connectTimeout=15000&acquireTimeout=15000`;

  const adapter = new PrismaMariaDb(cleanUrl);
  return new PrismaClient({ adapter });
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

// Always preserve singleton in globalThis for serverless warm lambda reuse
globalThis.prismaGlobal = prisma;

export default prisma;
