// The runtime smoke checks, written for any JavaScript runtime: no Node.js
// built-ins, only fetch, WebCrypto and timers. smoke.mjs runs them in Node.js,
// Bun and Deno, worker.mjs in workerd. `pkg` is the built package's core
// (dist/index.js); `context` comes from context.mjs.

const UA_DOCS = "+https://submitator.com/badge-package";

function fail(message) {
  throw new Error(message);
}

function same(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) fail(`${what}: got ${a}, expected ${b}`);
}

function decodeBase64Url(text) {
  const base64 = text.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs every check; resolves to [{ name, ok, detail }]. Never throws. */
export async function runChecks(pkg, context) {
  const results = [];
  const { apiUrl, projects, publicKeys, runtime, vector } = context;
  const logs = [];
  const options = (project, extra = {}) => ({
    project,
    apiUrl,
    publicKeys,
    log: (message) => logs.push(message),
    ...extra,
  });
  const mockRequests = async () => (await fetch(`${apiUrl}/__requests`)).json();

  async function check(name, body) {
    try {
      results.push({ name, ok: true, detail: (await body()) ?? "" });
    } catch (error) {
      results.push({ name, ok: false, detail: String(error?.message ?? error) });
    }
  }

  await check("the package loads", () => {
    if (typeof pkg.fetchWall !== "function") fail("fetchWall is missing");
    if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(pkg.VERSION)) fail(`VERSION is ${pkg.VERSION}`);
    return `version ${pkg.VERSION}`;
  });

  await check("WebCrypto verifies Ed25519 (RFC 8032 TEST 1)", async () => {
    const key = await crypto.subtle.importKey(
      "raw",
      decodeBase64Url(vector.publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const signature = decodeBase64Url(vector.emptyMessageSignature);
    const ok = await crypto.subtle.verify({ name: "Ed25519" }, key, signature, new Uint8Array(0));
    if (!ok) fail("the RFC 8032 TEST 1 signature did not verify");
  });

  await check(
    "verifyEnvelope accepts the shared vector and refuses a changed payload",
    async () => {
      const keys = { [vector.keyId]: vector.publicKey };
      const envelope = JSON.parse(vector.envelope);
      same(await pkg.verifyEnvelope(envelope, keys), vector.payload, "the vector's payload");
      const changed = { ...envelope, payload: envelope.payload.replace('"v":1', '"v":2') };
      same(await pkg.verifyEnvelope(changed, keys), null, "a changed payload");
    },
  );

  await check("parseWall gives every wall fixture its expected result", () => {
    for (const fixture of context.walls) {
      const wall = pkg.parseWall(fixture.payload, {
        project: fixture.project,
        now: Date.parse(fixture.now),
      });
      if (!fixture.expect.ok) {
        same(wall, null, fixture.name);
        continue;
      }
      if (wall === null) fail(`${fixture.name}: no wall`);
      same(
        wall.badges.map((badge) => badge.id ?? null),
        fixture.expect.ids,
        `${fixture.name} ids`,
      );
      same(wall.skipped, fixture.expect.skipped, `${fixture.name} skipped`);
    }
    return `${context.walls.length} walls`;
  });

  await check("wallToHtml writes every rendered fixture byte for byte", () => {
    const walls = new Map(context.walls.map((fixture) => [fixture.name, fixture]));
    for (const [file, expected] of Object.entries(context.rendered)) {
      const [name, layout] = file.replace(/\.html$/, "").split(/\.(?=marquee$|row$)/);
      const fixture = walls.get(name);
      if (fixture === undefined) fail(`${file}: no wall fixture`);
      const wall = pkg.parseWall(fixture.payload, {
        project: fixture.project,
        now: Date.parse(fixture.now),
      });
      const html = pkg
        .wallToHtml(wall, { layout })
        .replace(`data-sbm-wall="${pkg.VERSION}"`, 'data-sbm-wall="VERSION"');
      if (`${html}\n` !== expected) fail(`${file} differs`);
    }
    return `${Object.keys(context.rendered).length} files`;
  });

  await fetch(`${apiUrl}/__reset`, { method: "POST" });

  let good = null;
  await check("fetchWall gets the good wall from the mock server", async () => {
    good = await pkg.fetchWall(options(projects.good));
    if (good === null) fail(`no wall; log: ${logs.join(" | ")}`);
    same(
      good.badges.map((badge) => badge.id),
      context.goodIds,
      "badge ids",
    );
  });

  await check("a second call comes from memory, with no request", async () => {
    const again = await pkg.fetchWall(options(projects.good));
    if (again !== good) fail("the second call did not return the wall in memory");
    const requests = (await mockRequests()).filter((request) => request.project === projects.good);
    same(requests.length, 1, "requests for the good project");
  });

  await check("a bad signature, a 503 and an expired wall give null", async () => {
    for (const project of [projects.badSignature, projects.unavailable, projects.expired]) {
      same(await pkg.fetchWall(options(project)), null, project);
    }
  });

  await check("a badge that fails the checks is left out, the others shown", async () => {
    const wall = await pkg.fetchWall(options(projects.oneBadBadge));
    same(wall?.skipped, 1, "skipped");
    same(wall?.badges.length, context.goodIds.length, "badges shown");
  });

  await check("a slow answer: null within the timeout, then from memory", async () => {
    same(await pkg.fetchWall(options(projects.slow, { timeout: 300 })), null, "first call");
    await sleep(3500);
    const wall = await pkg.fetchWall(options(projects.slow, { timeout: 300 }));
    if (wall === null) fail("the late answer did not reach memory");
  });

  await check("every wall request carries the contract's User-Agent for this runtime", async () => {
    const requests = await mockRequests();
    if (requests.length === 0) fail("no requests recorded");
    const expected = `submitator-badges/${pkg.VERSION} (${runtime}; ${UA_DOCS})`;
    for (const request of requests) {
      same(request.userAgent, expected, "User-Agent");
      same(request.accept, "application/json", "Accept");
      same([request.origin, request.cookie], [null, null], "Origin and Cookie");
    }
    return expected;
  });

  await check("fetchWall returns null where a document exists (a browser)", async () => {
    const had = "document" in globalThis;
    if (had) fail("this runtime already has a document");
    globalThis.document = {};
    try {
      same(await pkg.fetchWall(options(projects.good)), null, "in a browser");
    } finally {
      delete globalThis.document;
    }
  });

  return results;
}
