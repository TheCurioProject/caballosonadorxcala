import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  const dbUrl = process.env.DATABASE_URL || '';
  
  if (!dbUrl) {
    console.warn('[Prisma] DATABASE_URL is not set. Using dummy client for build phase.');
    return new PrismaClient({});
  }

  // Clean the URL: fix common formatting issues
  let cleanUrl = dbUrl;
  cleanUrl = cleanUrl.replace(/@https?:\/\//, '@');
  cleanUrl = cleanUrl.replace(/@www\./, '@');
  cleanUrl = cleanUrl.replace(/\/:(\d+)/, ':$1');
  
  // Convert mariadb:// back to mysql:// for native Prisma
  cleanUrl = cleanUrl.replace(/^mariadb:\/\//, 'mysql://');

  // Enforce connection_limit=1 for Serverless
  cleanUrl = cleanUrl.replace(/([?&])connection_limit=\d+&?/, '$1');
  cleanUrl = cleanUrl.replace(/([?&])connectionLimit=\d+&?/, '$1');
  cleanUrl += `${cleanUrl.includes('?') ? '&' : '?'}connection_limit=1&connect_timeout=15`;

  process.env.DATABASE_URL = cleanUrl;

  return new PrismaClient({});
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

// Always preserve singleton in globalThis for serverless warm lambda reuse
globalThis.prismaGlobal = prisma;

export default prisma;
