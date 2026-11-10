import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import { api } from "../../../src/cala/features/workspace/context";

test("workspace requests bypass an old cached redirect loop", async ({
  page,
}) => {
  let redirecting = true;
  let requests = 0;
  const path =
    "/api/workspace?organizationId=org-estancia&propertyId=property-hotel";
  const server = createServer((request, response) => {
    if (request.url === path) {
      requests++;
      if (redirecting) {
        response.writeHead(308, {
          Location: path,
          "Cache-Control": "public, max-age=3600",
        });
        response.end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify({ currentPropertyId: "property-hotel" }));
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end("<!doctype html><title>API cache regression</title>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test server port");
    await page.goto(`http://127.0.0.1:${address.port}`);
    const fetchNormally = (url: string) =>
      fetch(url).then(
        () => "ok",
        () => "failed",
      );
    expect(await page.evaluate(fetchNormally, path)).toBe("failed");
    redirecting = false;
    const cachedRequests = requests;
    expect(await page.evaluate(fetchNormally, path)).toBe("failed");
    expect(requests).toBe(cachedRequests);

    const result = await page.evaluate(
      api<{ currentPropertyId: string }>,
      path,
    );
    expect(result.currentPropertyId).toBe("property-hotel");
    expect(requests).toBeGreaterThan(cachedRequests);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
