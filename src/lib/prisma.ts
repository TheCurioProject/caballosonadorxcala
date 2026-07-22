import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import mariadb from 'mariadb';

const prismaClientSingleton = () => {
  const dbUrl = process.env.DATABASE_URL || '';
  
  if (!dbUrl) {
    console.warn('[Prisma] DATABASE_URL is not set. Using dummy adapter for build phase.');
    // Provide a dummy string that satisfies the parsing for build phase
    const pool = mariadb.createPool('mariadb://user:pass@localhost:3306/db');
    const adapter = new PrismaMariaDb(pool);
    return new PrismaClient({ adapter });
  }

  // Clean the URL: fix common formatting issues
  let cleanUrl = dbUrl;
  cleanUrl = cleanUrl.replace(/@https?:\/\//, '@');
  cleanUrl = cleanUrl.replace(/@www\./, '@');
  cleanUrl = cleanUrl.replace(/\/:(\d+)/, ':$1');
  
  // The PrismaMariaDb adapter strictly expects mariadb:// instead of mysql://
  cleanUrl = cleanUrl.replace(/^mysql:\/\//, 'mariadb://');

  // For Vercel Serverless + Hostgator shared hosting, we explicitly set connectionLimit to 1.
  const pool = mariadb.createPool({
    uri: cleanUrl,
    connectionLimit: 1,
    connectTimeout: 15000,
    acquireTimeout: 15000
  });

  const adapter = new PrismaMariaDb(pool);
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
