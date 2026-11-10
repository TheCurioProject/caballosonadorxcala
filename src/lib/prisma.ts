import { PrismaClient } from "@prisma/client";
import { PrismaClient as SupabasePrismaClient } from "@/generated/site-postgres";
const prismaClientSingleton = () => {
  if (process.env.DATA_BACKEND === "supabase") {
    const raw = process.env.SUPABASE_DATABASE_URL;
    // Construction is lazy; a missing connection can never silently use the old database.
    const url = new URL(
      raw ||
        "postgresql://unconfigured:unconfigured@127.0.0.1:1/unconfigured?schema=site",
    );
    if (!["postgres:", "postgresql:"].includes(url.protocol))
      throw new Error("SUPABASE_DATABASE_URL must be PostgreSQL");
    url.searchParams.set("schema", "site");
    url.searchParams.set("connection_limit", "1");
    if (!url.searchParams.has("connect_timeout"))
      url.searchParams.set("connect_timeout", "15");
    // Both generated clients share the existing site model contract. The Supabase client adds only a nullable admin UID.
    return new SupabasePrismaClient({
      datasources: { db: { url: url.toString() } },
    }) as unknown as PrismaClient;
  }
  let raw = process.env.DATABASE_URL;
  if (raw) {
    raw = raw
      .replace(/@https?:\/\//, "@")
      .replace(/@www\./, "@")
      .replace(/\/:(\d+)/, ":$1")
      .replace(/^mariadb:\/\//, "mysql://");
    const url = new URL(raw);
    url.searchParams.delete("connectionLimit");
    url.searchParams.set("connection_limit", "1");
    if (!url.searchParams.has("connect_timeout"))
      url.searchParams.set("connect_timeout", "15");
    return new PrismaClient({ datasources: { db: { url: url.toString() } } });
  }
  return new PrismaClient({});
};
declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();
globalThis.prismaGlobal = prisma;
export default prisma;
