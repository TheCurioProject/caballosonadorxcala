import { execFileSync } from "node:child_process";
// Generates clients only; never connects to, pushes or migrates a database.
for (const schema of [
  "prisma/schema.prisma",
  "prisma/supabase/schema.prisma",
]) {
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "generate", "--schema", schema],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ||
          "mysql://build:build@127.0.0.1:3306/build",
        SUPABASE_DATABASE_URL:
          process.env.SUPABASE_DATABASE_URL ||
          "postgresql://build:build@127.0.0.1:5432/build?schema=site",
        SUPABASE_DIRECT_URL:
          process.env.SUPABASE_DIRECT_URL ||
          "postgresql://build:build@127.0.0.1:5432/build?schema=site",
      },
    },
  );
}
