import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
type Event = {
  request?: { method: string; url: string; mode: string };
  waitUntil?: (work: Promise<unknown>) => void;
  respondWith?: (work: Promise<Response>) => void;
};
test("the admin worker caches public assets only and leaves website navigation and all private API traffic alone", async () => {
  const listeners: Record<string, (event: Event) => void> = {},
    cached: string[][] = [];
  runInNewContext(readFileSync("public/admin/sw.js", "utf8"), {
    URL,
    Response,
    self: {
      location: { origin: "https://app.example.test" },
      addEventListener: (name: string, callback: (event: Event) => void) => {
        listeners[name] = callback;
      },
      clients: { claim: async () => {} },
      skipWaiting: () => {},
    },
    caches: {
      open: async () => ({
        addAll: async (paths: string[]) => {
          cached.push(paths);
        },
      }),
      keys: async () => [],
      delete: async () => true,
      match: async () => new Response("public offline screen"),
    },
    fetch: async () => {
      throw new Error("offline");
    },
  });
  let install: Promise<unknown> | undefined;
  listeners.install({
    waitUntil: (work) => {
      install = work;
    },
  });
  await install;
  expect(cached[0]).toContain("/cala/offline.html");
  expect(cached[0].every((path) => path.startsWith("/cala/"))).toBe(true);
  for (const [method, path, mode] of [
    ["GET", "/api/cala/workspace/", "cors"],
    ["POST", "/api/cala/commands/", "cors"],
    ["GET", "/es/", "navigate"],
  ]) {
    let intercepted = false;
    listeners.fetch({
      request: { method, url: "https://app.example.test" + path, mode },
      respondWith: () => {
        intercepted = true;
      },
    });
    expect(intercepted).toBe(false);
  }
  let fallback: Promise<Response> | undefined;
  listeners.fetch({
    request: {
      method: "GET",
      url: "https://app.example.test/admin/calendario/",
      mode: "navigate",
    },
    respondWith: (work) => {
      fallback = work;
    },
  });
  expect(await (await fallback!).text()).toBe("public offline screen");
});
