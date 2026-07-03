import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const prismaClientSingleton = () => {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('[Prisma] DATABASE_URL is not set. Database operations will fail.');
    const adapter = new PrismaMariaDb('');
    return new PrismaClient({ adapter });
  }

  // Clean the URL: fix common formatting issues
  let cleanUrl = dbUrl;
  // Fix: mysql://user:pass@https://www.domain.com/:3306/db → mysql://user:pass@domain.com:3306/db
  cleanUrl = cleanUrl.replace(/@https?:\/\//, '@');
  cleanUrl = cleanUrl.replace(/@www\./, '@');
  // Fix trailing slash before port: domain.com/:3306 → domain.com:3306
  cleanUrl = cleanUrl.replace(/\/:(\d+)/, ':$1');
  
  // Ensure connection pool settings for serverless environments
  if (!cleanUrl.includes('connection_limit')) {
    const separator = cleanUrl.includes('?') ? '&' : '?';
    cleanUrl += `${separator}connection_limit=3&pool_timeout=15`;
  }
  
  // The PrismaMariaDb adapter strictly expects mariadb:// instead of mysql://
  cleanUrl = cleanUrl.replace(/^mysql:\/\//, 'mariadb://');

  const adapter = new PrismaMariaDb(cleanUrl);
  return new PrismaClient({ adapter });
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
