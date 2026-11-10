// Synthetic Supabase HTTP boundary over the real migrated PostgreSQL engine.
// Test-only; it is never imported by the app and binds only to loopback.
import http from "node:http";
import crypto from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
export async function startFixture(port = 3212) {
  const db = new PGlite(),
    owner = "b0000000-0000-0000-0000-000000000001";
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`,
  );
  for (const name of (await readdir("supabase/migrations"))
    .filter((x) => x.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + name, "utf8"));
  await db.query("insert into auth.users values($1,$2)", [
    owner,
    "owner@example.test",
  ]);
  const scope = (
    await db.query("select site.bootstrap_cala($1::uuid) as data", [owner])
  ).rows[0].data;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mazatlan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const add = (day, n) =>
    new Date(Date.parse(day + "T00:00:00Z") + n * 86400000)
      .toISOString()
      .slice(0, 10);
  await db.query(
    `insert into site.reservas(property_id,start_date,end_date,"guestName","guestEmail",payment_status,origin,"totalPrice",updated_at) values(1,$1,$2,'Huésped de prueba','guest@example.test','CONFIRMED','WEBSITE',30000,now())`,
    [add(today, 1), add(today, 3)],
  );
  const secret = "local-synthetic-auth-fixture",
    user = {
      id: owner,
      aud: "authenticated",
      role: "authenticated",
      email: "owner@example.test",
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {
        name: "Operador de prueba",
        cala_assistant_completed: true,
      },
      identities: [],
    };
  const jwt = () => {
    const first = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" }),
      ).toString("base64url"),
      payload = Buffer.from(
        JSON.stringify({
          sub: owner,
          aud: "authenticated",
          role: "authenticated",
          email: user.email,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url");
    const body = first + "." + payload;
    return (
      body +
      "." +
      crypto.createHmac("sha256", secret).update(body).digest("base64url")
    );
  };
  const valid = (token) => {
    if (!token) return false;
    const parts = token.split(".");
    return (
      parts.length === 3 &&
      crypto
        .createHmac("sha256", secret)
        .update(parts.slice(0, 2).join("."))
        .digest("base64url") === parts[2]
    );
  };
  let queue = Promise.resolve();
  const serial = (fn) => {
    const next = queue.then(fn);
    queue = next.catch(() => {});
    return next;
  };
  const tables = new Set(
    (
      await db.query(
        "select tablename from pg_tables where schemaname='public'",
      )
    ).rows.map((x) => x.tablename),
  );
  const dateColumns = (
    await db.query(
      "select table_name,column_name from information_schema.columns where table_schema='public' and data_type='date'",
    )
  ).rows;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const send = (status, data, headers = {}) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...headers,
      });
      res.end(
        status === 204
          ? undefined
          : JSON.stringify(data, (_, value) =>
              typeof value === "bigint" ? Number(value) : value,
            ),
      );
    };
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let input;
    try {
      input = raw ? JSON.parse(raw) : {};
    } catch {
      return send(400, { error: "invalid_json" });
    }
    if (url.pathname === "/auth/v1/token") {
      if (
        input.email !== user.email ||
        input.password !== "Fixture-only-password-2026"
      )
        return send(400, {
          error: "invalid_credentials",
          msg: "Invalid login credentials",
        });
      return send(200, {
        access_token: jwt(),
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "fixture-refresh-token",
        user,
      });
    }
    const token = req.headers.authorization?.replace(/^Bearer /i, "");
    if (url.pathname === "/auth/v1/.well-known/jwks.json")
      return send(200, { keys: [] });
    if (!valid(token))
      return send(401, { message: "Invalid JWT", code: "bad_jwt" });
    if (url.pathname === "/auth/v1/user") return send(200, user);
    if (url.pathname === "/auth/v1/logout") return send(204, {});
    try {
      const result = await serial(async () => {
        await db.exec(
          `reset role;select set_config('request.jwt.claim.sub','${owner}',false);set role authenticated;`,
        );
        if (url.pathname === "/rest/v1/rpc/pms_command") {
          const result = await db.query(
            "select public.pms_command($1::jsonb,$2::text) as data",
            [JSON.stringify(input.command), input.idempotency_key],
          );
          return { data: result.rows[0].data };
        }
        if (url.pathname === "/rest/v1/rpc/pms_reservations")
          return {
            data: (
              await db.query("select public.pms_reservations($1,$2) as data", [
                input.org,
                input.prop,
              ])
            ).rows[0].data,
          };
        const table = url.pathname.split("/")[3];
        if (!tables.has(table)) throw new Error("Unknown test table");
        const columns = url.searchParams.get("select") || "*";
        if (columns !== "*" && !/^[a-z_,]+$/.test(columns))
          throw new Error("Invalid test selection");
        const values = [],
          where = [];
        for (const [key, value] of url.searchParams) {
          if (["select", "order", "offset", "limit"].includes(key)) continue;
          if (!/^[a-z_]+$/.test(key)) throw new Error("Invalid test filter");
          if (value.startsWith("eq.")) {
            values.push(value.slice(3));
            where.push(`"${key}"::text=$${values.length}`);
          } else if (value.startsWith("in.(")) {
            const list = value
              .slice(4, -1)
              .split(",")
              .map((x) => x.replace(/^"|"$/g, ""));
            values.push(list);
            where.push(`"${key}"::text=any($${values.length}::text[])`);
          } else throw new Error("Unsupported test filter");
        }
        const order = (url.searchParams.get("order") || "").split(".")[0];
        if (order && !/^[a-z_]+$/.test(order)) throw new Error("Invalid order");
        const predicate = where.length ? " where " + where.join(" and ") : "";
        const offset = Math.max(0, Number(url.searchParams.get("offset") || 0)),
          limit = Math.min(
            1000,
            Math.max(1, Number(url.searchParams.get("limit") || 1000)),
          );
        const total = Number(
          (
            await db.query(
              `select count(*) as count from public."${table}"${predicate}`,
              values,
            )
          ).rows[0].count,
        );
        const rows = (
          await db.query(
            `select ${columns} from public."${table}"${predicate} ${order ? `order by "${order}"` : ""} limit ${limit} offset ${offset}`,
            values,
          )
        ).rows;
        for (const row of rows)
          for (const col of dateColumns.filter(
            (col) => col.table_name === table,
          ))
            if (row[col.column_name] != null)
              row[col.column_name] =
                row[col.column_name] instanceof Date
                  ? row[col.column_name].toISOString().slice(0, 10)
                  : String(row[col.column_name]).slice(0, 10);
        return { data: rows, total, offset };
      });
      if (req.headers.accept?.includes("application/vnd.pgrst.object+json")) {
        if (result.data.length !== 1)
          return send(406, { code: "PGRST116", message: "Expected one row" });
        return send(200, result.data[0]);
      }
      return send(
        200,
        result.data,
        result.total == null
          ? {}
          : {
              "Content-Range": `${result.offset}-${result.offset + result.data.length - 1}/${result.total}`,
            },
      );
    } catch (error) {
      return send(409, {
        code: error.code || "TEST_DATABASE_ERROR",
        message: error.message,
      });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    scope,
    today,
    db,
    env: {
      DATA_BACKEND: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${port}`,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_fixture",
      SUPABASE_DATABASE_URL:
        "postgresql://cala_site_app:fixture@127.0.0.1:1/fixture?schema=site",
      CALA_ORGANIZATION_ID: scope.organizationId,
      CALA_DEFAULT_PROPERTY_ID: scope.defaultPropertyId,
    },
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}
