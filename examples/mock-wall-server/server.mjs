// A wall server for the example apps and the runtime smoke tests. It answers
// GET /badge/<project>/wall/v1 like the real one (CONTRACT.md sections 2 to 4)
// and signs with the RFC 8032 test key, which the package accepts only through
// `publicKeys` with a local `apiUrl`. No dependencies: Node.js 20 or later.
//
//   node examples/mock-wall-server/server.mjs [--port 4010] [--host 127.0.0.1]
//
// Projects (projects.mjs): ...0001 a good wall, ...0002 a bad signature,
// ...0003 503 (the kill switch), ...0004 a good wall 3 s late, ...0005 an
// expired wall, ...0006 one badge the package must leave out. Others: 404.
//
// Test hooks:
//   POST /__bump?project=<id>  adds a directory badge and signs a newer wall
//   GET  /__requests           the wall requests so far, with their headers
//   POST /__reset              forgets requests and bumps
//   GET  /__health             200
import { createPrivateKey, sign } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import {
  BAD_BADGE,
  BUMP_BADGE,
  DEFAULT_PORT,
  PROJECTS,
  TEST_KEY,
  goodBadges,
} from "./projects.mjs";

const DAY_MS = 86_400_000;
const WALL_PATH = /^\/badge\/([^/]+)\/wall\/v1$/;
const SLOW_MS = 3000;

const privateKey = createPrivateKey({
  key: { kty: "OKP", crv: "Ed25519", d: TEST_KEY.seed, x: TEST_KEY.publicKey },
  format: "jwk",
});

/** Whole seconds, like the server writes them: 2026-11-01T00:00:00Z. */
function isoSeconds(ms) {
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(".000Z", "Z");
}

function signText(text) {
  return sign(null, Buffer.from(text, "utf8"), privateKey).toString("base64url");
}

/** The envelope body of a wall: { payload, signature, keyId }. */
export function envelope(wall, { badSignature = false } = {}) {
  const payload = JSON.stringify(wall);
  // A real signature, over other bytes: right shape, wrong payload.
  const signature = signText(badSignature ? `${payload} ` : payload);
  return JSON.stringify({ payload, signature, keyId: TEST_KEY.keyId });
}

/**
 * Starts the server. Resolves to { url, close, requests }. Port 0 picks a free port.
 */
export function startMockServer({ port = DEFAULT_PORT, host = "127.0.0.1" } = {}) {
  /** @type {Array<Record<string, string | number | null>>} */
  const requests = [];
  /** Badges added by /__bump, per project. */
  const bumps = new Map();
  /** Signed bodies per project, built once (the real server caches them too). */
  const bodies = new Map();
  /** The issuedAt of the last body per project, so a bump always signs a newer wall. */
  const issued = new Map();

  function wallFor(project, nowMs) {
    let issuedMs = Math.floor(nowMs / 1000) * 1000;
    const previous = issued.get(project);
    if (previous !== undefined && issuedMs <= previous) issuedMs = previous + 1000;
    issued.set(project, issuedMs);
    let badges = [...goodBadges(project), ...(bumps.get(project) ?? [])];
    if (project === PROJECTS.oneBadBadge) badges = [badges[0], BAD_BADGE, ...badges.slice(1)];
    if (project === PROJECTS.expired) issuedMs = nowMs - 8 * DAY_MS;
    return {
      v: 1,
      project,
      issuedAt: isoSeconds(issuedMs),
      expiresAt: isoSeconds(issuedMs + 7 * DAY_MS),
      badges,
    };
  }

  function bodyFor(project) {
    let body = bodies.get(project);
    if (body === undefined) {
      body = envelope(wallFor(project, Date.now()), {
        badSignature: project === PROJECTS.badSignature,
      });
      bodies.set(project, body);
    }
    return body;
  }

  function record(req, project, status) {
    requests.push({
      at: new Date().toISOString(),
      method: req.method ?? "",
      path: req.url ?? "",
      project,
      status,
      userAgent: req.headers["user-agent"] ?? null,
      accept: req.headers["accept"] ?? null,
      origin: req.headers["origin"] ?? null,
      cookie: req.headers["cookie"] ?? null,
    });
  }

  function send(res, status, headers, body = "") {
    res.writeHead(status, headers);
    res.end(body);
  }

  async function handle(req, res) {
    const url = new URL(req.url ?? "/", "http://mock.invalid");
    const wallMatch = WALL_PATH.exec(url.pathname);

    if (wallMatch !== null && req.method === "GET" && url.search === "") {
      const project = wallMatch[1];
      const known = Object.values(PROJECTS).includes(project);
      if (!known) {
        record(req, project, 404);
        return send(res, 404, { "X-Robots-Tag": "noindex", "Access-Control-Allow-Origin": "*" });
      }
      if (project === PROJECTS.unavailable) {
        record(req, project, 503);
        return send(res, 503, {
          "Cache-Control": "no-store",
          "Retry-After": "300",
          "Access-Control-Allow-Origin": "*",
        });
      }
      if (project === PROJECTS.slow) await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
      record(req, project, 200);
      const body = Buffer.from(bodyFor(project), "utf8");
      return send(
        res,
        200,
        {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": String(body.length),
          "Cache-Control": "max-age=60, public, stale-while-revalidate=60",
          "X-Robots-Tag": "noindex",
          "X-Content-Type-Options": "nosniff",
          "Access-Control-Allow-Origin": "*",
        },
        body,
      );
    }

    if (url.pathname === "/__health" && req.method === "GET") {
      return send(res, 200, { "Content-Type": "text/plain" }, "ok\n");
    }
    if (url.pathname === "/__requests" && req.method === "GET") {
      return send(res, 200, { "Content-Type": "application/json" }, JSON.stringify(requests));
    }
    if (url.pathname === "/__reset" && req.method === "POST") {
      requests.length = 0;
      bumps.clear();
      bodies.clear();
      return send(res, 204, {});
    }
    if (url.pathname === "/__bump" && req.method === "POST") {
      const project = url.searchParams.get("project") ?? PROJECTS.good;
      if (!Object.values(PROJECTS).includes(project)) return send(res, 404, {});
      bumps.set(project, [...(bumps.get(project) ?? []), BUMP_BADGE]);
      bodies.delete(project);
      return send(
        res,
        200,
        { "Content-Type": "application/json" },
        JSON.stringify({ project, host: BUMP_BADGE.host }),
      );
    }
    return send(res, 404, { "X-Robots-Tag": "noindex" });
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) send(res, 500, {});
      else res.destroy();
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address !== null ? address.port : port;
      resolve({
        url: `http://${host}:${actualPort}`,
        requests,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections?.();
            server.close(() => done());
          }),
      });
    });
  });
}

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(option("port", process.env.MOCK_WALL_PORT ?? DEFAULT_PORT));
  const host = option("host", "127.0.0.1");
  const mock = await startMockServer({ port, host });
  console.log(`mock wall server listening on ${mock.url}`);
  const stop = () => mock.close().then(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
