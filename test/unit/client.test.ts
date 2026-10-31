import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DIRECTORY_BADGES, selfLink } from "../../scripts/fixture-cases.mjs";
import { signWithTestKey } from "../../scripts/write-fixtures.mjs";
import {
  createClient,
  fetchWall,
  normalizeApiUrl,
  retryAfterMs,
  type ClientEnv,
  type RequestInitLike,
  type ResponseLike,
  type Slot,
} from "../../src/client.js";
import { sleep } from "../../src/runtime.js";
import type { FetchWallOptions, Wall } from "../../src/types.js";
import { VERSION } from "../../src/version.js";
import { testKeys } from "../support/fixtures.js";

const API = "http://localhost:3001";
const PROJECT = "8b0c2f4e-6a51-4c1e-9f3d-2a7b5c9e1d40";
const KEYS = testKeys();
const T0 = Date.parse("2026-11-02T00:00:00Z");
const MINUTE = 60_000;
const DAY = 86_400_000;
const encoder = new TextEncoder();

// The server's User-Agent pattern (CONTRACT.md section 9), in JavaScript.
const SERVER_UA =
  /^submitator-badges\/(?<version>\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.]{1,20})?)(?: \((?<comment>[^()]{0,200})\))?$/;

const iso = (ms: number) => new Date(ms).toISOString().replace(".000Z", "Z");

interface WallSpec {
  project?: string;
  issuedAt?: number;
  lifetime?: number;
  badges?: unknown[];
}

function payloadFor({
  project = PROJECT,
  issuedAt = T0 - MINUTE,
  lifetime = 7 * DAY,
  badges = [selfLink(project)],
}: WallSpec = {}): string {
  return JSON.stringify({
    v: 1,
    project,
    issuedAt: iso(issuedAt),
    expiresAt: iso(issuedAt + lifetime),
    badges,
  });
}

function envelopeFor(spec: WallSpec = {}): string {
  const payload = payloadFor(spec);
  return JSON.stringify({ payload, signature: signWithTestKey(payload), keyId: "test-rfc8032-1" });
}

interface BodyStats {
  readerTaken: boolean;
  reads: number;
  cancelled: boolean;
}

/** A response whose body yields `chunks`; stats tell how much of it was read. */
function respond(
  status: number,
  chunks: Iterable<Uint8Array> = [],
  headers: Record<string, string> = {},
): ResponseLike & { stats: BodyStats } {
  const stats: BodyStats = { readerTaken: false, reads: 0, cancelled: false };
  const iterator = chunks[Symbol.iterator]();
  const body = {
    getReader() {
      stats.readerTaken = true;
      return {
        async read() {
          stats.reads += 1;
          const next = iterator.next();
          return next.done ? { done: true, value: undefined } : { done: false, value: next.value };
        },
        async cancel() {
          stats.cancelled = true;
        },
      };
    },
    async cancel() {
      stats.cancelled = true;
    },
  };
  return {
    status,
    headers: new Headers(headers),
    body: body as unknown as ReadableStream<Uint8Array>,
    arrayBuffer: async () => new ArrayBuffer(0),
    stats,
  };
}

const ok = (text: string, headers: Record<string, string> = {}) =>
  respond(200, [encoder.encode(text)], { "content-type": "application/json", ...headers });

type Reply = (url: string, init: RequestInitLike) => ResponseLike | Promise<ResponseLike>;

/** The project a wall URL asks for. */
const projectOf = (url: string) => /\/badge\/([^/]+)\/wall\/v1$/.exec(url)?.[1] ?? "";

function setup(overrides: Partial<ClientEnv> = {}) {
  const requests: Array<{ url: string; init: RequestInitLike }> = [];
  const logs: string[] = [];
  let reply: Reply = (url) => ok(envelopeFor({ project: projectOf(url) }));
  const env: ClientEnv = {
    fetch: async (url, init) => {
      requests.push({ url, init });
      return reply(url, init);
    },
    now: () => Date.now(),
    macrotask: () => Promise.resolve(),
    sleep,
    deadline: () => undefined,
    isBrowser: () => false,
    isNext: () => false,
    nodeEnv: () => undefined,
    runtime: () => "node",
    warn: (message) => logs.push(message),
    ...overrides,
  };
  const slots = new Map<string, Slot>();
  const client = createClient(env, slots);
  return {
    client,
    requests,
    logs,
    slots,
    /** Wall requests only (not the Next.js lifetime marks). */
    wallRequests: () => requests.filter((request) => !request.url.startsWith("data:")),
    replyWith(next: Reply) {
      reply = next;
    },
    call(options: Partial<FetchWallOptions> = {}) {
      return client.fetchWall({ project: PROJECT, apiUrl: API, publicKeys: KEYS, ...options });
    },
    /** Waits for every background refresh to finish. */
    async settle() {
      await Promise.all([...slots.values()].map((slot) => slot.pending));
    },
  };
}

/** A promise you settle by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers({ now: T0, toFake: ["setTimeout", "clearTimeout", "Date"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the first wall", () => {
  test("arrives when the server answers within the timeout", async () => {
    const t = setup();
    const wall = await t.call();
    expect(wall?.project).toBe(PROJECT);
    expect(wall?.badges.map((badge) => badge.id)).toEqual(["self"]);
    expect(t.wallRequests()).toHaveLength(1);
  });

  test("waits for it up to the timeout, then returns null", async () => {
    const t = setup();
    t.replyWith(() => new Promise<ResponseLike>(() => undefined));
    const call = t.call();
    await vi.advanceTimersByTimeAsync(1999);
    let settled = false;
    void call.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await call).toBeNull();
  });

  test("a late answer fills memory for the next call", async () => {
    const t = setup();
    const late = deferred<ResponseLike>();
    t.replyWith(() => late.promise);
    const first = t.call();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await first).toBeNull();
    late.resolve(ok(envelopeFor()));
    await t.settle();
    expect((await t.call())?.project).toBe(PROJECT);
    expect(t.wallRequests()).toHaveLength(1);
  });

  test("makes one request for concurrent callers", async () => {
    const t = setup();
    const answer = deferred<ResponseLike>();
    t.replyWith(() => answer.promise);
    const calls = Array.from({ length: 5 }, () => t.call());
    await Promise.resolve();
    answer.resolve(ok(envelopeFor()));
    const walls = await Promise.all(calls);
    expect(walls.every((wall) => wall?.project === PROJECT)).toBe(true);
    expect(t.wallRequests()).toHaveLength(1);
  });
});

describe("memory", () => {
  test("serves a fresh wall from memory with no request", async () => {
    const t = setup();
    const first = await t.call();
    vi.advanceTimersByTime(59_000);
    expect(await t.call()).toBe(first);
    expect(t.wallRequests()).toHaveLength(1);
  });

  test("serves a stale wall at once and refreshes in the background", async () => {
    const t = setup();
    const first = await t.call();
    vi.advanceTimersByTime(60_000);
    const answer = deferred<ResponseLike>();
    t.replyWith(() => answer.promise);
    expect(await t.call()).toBe(first);
    expect(t.wallRequests()).toHaveLength(2);
    answer.resolve(ok(envelopeFor({ issuedAt: T0, badges: [selfLink(), DIRECTORY_BADGES[0]] })));
    await t.settle();
    const second = await t.call();
    expect(second?.badges).toHaveLength(2);
    expect(t.wallRequests()).toHaveLength(2);
  });

  test("keeps the last good wall on 503, 404, a redirect, garbage and a bad signature", async () => {
    const t = setup();
    const good = await t.call();
    const bad: Array<() => ResponseLike> = [
      () => respond(503, [], { "retry-after": "30" }),
      () => respond(404),
      () => respond(302, [], { location: "https://x.example" }),
      () => ok("<html>maintenance</html>"),
      () => {
        const envelope = JSON.parse(envelopeFor({ issuedAt: T0 })) as { payload: string };
        envelope.payload = envelope.payload.replace("Featured", "Featured!");
        return ok(JSON.stringify(envelope));
      },
    ];
    for (const reply of bad) {
      vi.advanceTimersByTime(60_000);
      t.replyWith(reply);
      expect(await t.call()).toBe(good);
      await t.settle();
    }
    expect(t.wallRequests()).toHaveLength(1 + bad.length);
    // Once per reason until a success: the 404 and the 302 are http again.
    const hint = "the last good badges stay up until they expire";
    expect(t.logs).toEqual([
      `[@submitator/badges] the badge server answered 503: ${hint}`,
      `[@submitator/badges] the answer is not JSON: ${hint}`,
      `[@submitator/badges] the signature does not match the payload: ${hint}`,
    ]);
  });

  test("logs a reason again after a success", async () => {
    const t = setup();
    await t.call();
    for (const reply of [
      () => respond(503),
      () => ok(envelopeFor({ issuedAt: T0 })),
      () => respond(503),
    ]) {
      vi.advanceTimersByTime(60_000);
      t.replyWith(reply);
      await t.call();
      await t.settle();
    }
    expect(t.logs).toHaveLength(2);
  });

  test("never replaces a wall with an older issuedAt", async () => {
    const t = setup();
    const newer = await t.call();
    vi.advanceTimersByTime(60_000);
    t.replyWith(() => ok(envelopeFor({ issuedAt: T0 - 2 * 60 * MINUTE, badges: [] })));
    await t.call();
    await t.settle();
    expect(await t.call()).toBe(newer);
    expect(t.wallRequests()).toHaveLength(2);
  });

  test("a wall stamped up to 10 minutes ahead of the clock still keeps older walls out", async () => {
    const t = setup();
    t.replyWith(() => ok(envelopeFor({ issuedAt: T0 + 10 * MINUTE })));
    const ahead = await t.call();
    vi.advanceTimersByTime(60_000);
    t.replyWith(() => ok(envelopeFor({ issuedAt: T0 - MINUTE })));
    await t.call();
    await t.settle();
    expect(await t.call()).toBe(ahead);
  });

  // A server clock running a year fast once: its wall must not stay up for a year.
  test("a wall stamped further ahead of the clock gives way to the next wall", async () => {
    const t = setup();
    t.replyWith(() => ok(envelopeFor({ issuedAt: T0 + 365 * DAY })));
    await t.call();
    vi.advanceTimersByTime(60_000);
    t.replyWith(() => ok(envelopeFor({ issuedAt: T0 })));
    await t.call();
    await t.settle();
    expect((await t.call())?.issuedAt).toBe(iso(T0));
  });

  test("stops serving a wall once it expires", async () => {
    const t = setup();
    t.replyWith(() => ok(envelopeFor({ issuedAt: T0 - MINUTE, lifetime: 2 * MINUTE })));
    expect(await t.call()).not.toBeNull();
    t.replyWith(() => respond(503));
    vi.advanceTimersByTime(MINUTE - 1);
    expect(await t.call()).not.toBeNull();
    await t.settle();
    vi.advanceTimersByTime(1);
    expect(await t.call()).toBeNull();
  });

  test("keeps separate memory per apiUrl, project and key set", async () => {
    const t = setup();
    const other = "11111111-2222-4333-8444-555555555555";
    await t.call();
    await t.call({ project: other });
    await t.call({ apiUrl: "http://127.0.0.1:3001" });
    await t.call({ publicKeys: { "local-2": KEYS["test-rfc8032-1"]! } });
    expect(t.wallRequests()).toHaveLength(4);
    await t.call();
    await t.call({ project: other.toUpperCase() });
    await t.call({ apiUrl: "http://127.0.0.1:3001/" });
    expect(t.wallRequests()).toHaveLength(4);
  });

  test("evicts the least recently used project past 100", async () => {
    const t = setup();
    const project = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    for (let n = 0; n <= 100; n += 1) await t.call({ project: project(n) });
    expect(t.slots.size).toBe(100);
    expect(t.wallRequests()).toHaveLength(101);
    await t.call({ project: project(100) });
    expect(t.wallRequests()).toHaveLength(101);
    await t.call({ project: project(0) });
    expect(t.wallRequests()).toHaveLength(102);
  });

  test("does not check an identical envelope twice", async () => {
    const t = setup();
    const envelope = envelopeFor();
    t.replyWith(() => ok(envelope));
    const verify = vi.spyOn(crypto.subtle, "verify");
    const first = await t.call();
    vi.advanceTimersByTime(60_000);
    await t.call();
    await t.settle();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(await t.call()).toBe(first);
    expect(t.wallRequests()).toHaveLength(2);
  });
});

describe("failures", () => {
  test("waits 30 s after a failure", async () => {
    const t = setup();
    t.replyWith(() => respond(503));
    expect(await t.call()).toBeNull();
    vi.advanceTimersByTime(29_999);
    expect(await t.call()).toBeNull();
    expect(t.wallRequests()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    await t.call();
    expect(t.wallRequests()).toHaveLength(2);
  });

  test.each([
    ["120", 120_000],
    ["5", 30_000],
    ["99999", 600_000],
    ["soon", 30_000],
  ])("honours Retry-After %s within 30 to 600 s", async (header, wait) => {
    const t = setup();
    t.replyWith(() => respond(503, [], { "retry-after": header }));
    await t.call();
    vi.advanceTimersByTime(wait - 1);
    await t.call();
    expect(t.wallRequests()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    await t.call();
    expect(t.wallRequests()).toHaveLength(2);
  });

  test("reads Retry-After as an HTTP date too, and on 429", () => {
    expect(retryAfterMs(new Date(T0 + 90_000).toUTCString(), T0)).toBe(90_000);
    expect(retryAfterMs(null, T0)).toBe(30_000);
  });

  test("drops a request stuck past its deadline", async () => {
    const t = setup();
    t.replyWith(() => new Promise<ResponseLike>(() => undefined));
    const first = t.call();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await first).toBeNull();
    vi.advanceTimersByTime(13_000);
    const waiting = t.call();
    await vi.advanceTimersByTimeAsync(2000);
    await waiting;
    expect(t.wallRequests()).toHaveLength(1);
    t.replyWith(() => ok(envelopeFor()));
    expect((await t.call())?.project).toBe(PROJECT);
    expect(t.wallRequests()).toHaveLength(2);
  });

  test("refuses a body whose Content-Length is over 1 MiB without reading it", async () => {
    const t = setup();
    const big = respond(200, [encoder.encode(envelopeFor())], { "content-length": "1048577" });
    t.replyWith(() => big);
    expect(await t.call()).toBeNull();
    expect(big.stats.readerTaken).toBe(false);
    expect(big.stats.cancelled).toBe(true);
    expect(t.logs).toEqual([
      "[@submitator/badges] the answer is over 1 MiB: no badges are shown until a refresh works",
    ]);
  });

  test("stops reading a body past 1 MiB", async () => {
    const t = setup();
    const chunk = new Uint8Array(256 * 1024).fill(32);
    const endless = respond(200, {
      *[Symbol.iterator]() {
        for (;;) yield chunk;
      },
    });
    t.replyWith(() => endless);
    expect(await t.call()).toBeNull();
    expect(endless.stats.reads).toBe(5);
    expect(endless.stats.cancelled).toBe(true);
  });

  test("accepts a body of exactly 1 MiB", async () => {
    const t = setup();
    const envelope = envelopeFor();
    const padded = envelope + " ".repeat(1_048_576 - encoder.encode(envelope).length);
    t.replyWith(() => ok(padded));
    expect(await t.call()).not.toBeNull();
  });

  test.each([
    ["a network error", new TypeError("fetch failed"), "could not reach http://localhost:3001"],
    [
      "a timeout",
      new DOMException("The operation was aborted due to timeout", "TimeoutError"),
      "http://localhost:3001 did not answer within 10 seconds",
    ],
  ])("logs %s once per problem until a success", async (_label, error, message) => {
    const t = setup();
    t.replyWith(() => Promise.reject(error));
    await t.call();
    vi.advanceTimersByTime(30_000);
    await t.call();
    expect(t.wallRequests()).toHaveLength(2);
    expect(t.logs).toEqual([
      `[@submitator/badges] ${message}: no badges are shown until a refresh works`,
    ]);
  });

  test("names the unknown key and how to fix it", async () => {
    const t = setup();
    await t.call({ publicKeys: { "local-1": KEYS["test-rfc8032-1"]! } });
    expect(t.logs).toEqual([
      "[@submitator/badges] the wall is signed with a key this package does not know (test-rfc8032-1): update @submitator/badges, or check apiUrl and publicKeys",
    ]);
  });

  test("refuses a wall for another project", async () => {
    const t = setup();
    t.replyWith(() => ok(envelopeFor({ project: "11111111-2222-4333-8444-555555555555" })));
    expect(await t.call()).toBeNull();
    expect(t.logs.at(-1)).toContain("the wall is for another project");
  });

  test("warns once about skipped badges, with the count", async () => {
    const t = setup();
    const badges = [
      selfLink(),
      { kind: "directory", tree: [{ t: "div" }] },
      { kind: "spam", tree: [] },
    ];
    t.replyWith(() => ok(envelopeFor({ badges })));
    expect((await t.call())?.skipped).toBe(2);
    vi.advanceTimersByTime(60_000);
    t.replyWith(() => ok(envelopeFor({ badges, issuedAt: T0 })));
    await t.call();
    await t.settle();
    expect(t.logs).toEqual([
      "[@submitator/badges] 2 badges were left out because they failed the checks (tag, kind): the others are shown",
    ]);
  });
});

describe("options", () => {
  test.each([
    ["not a UUID", { project: "my-project" }],
    ["empty", { project: "" }],
    ["a number", { project: 42 as unknown as string }],
  ])("returns null and warns once for a project that is %s", async (_label, options) => {
    const t = setup();
    expect(await t.call(options)).toBeNull();
    expect(await t.call(options)).toBeNull();
    expect(t.requests).toHaveLength(0);
    expect(t.logs).toEqual([
      "[@submitator/badges] project must be your project's public id, a UUID: no badges are shown",
    ]);
  });

  test.each([
    "ftp://api.example.com",
    "http://api.example.com",
    "http://localhost.example.com",
    "https://user:secret@api.example.com",
    "https://api.example.com?x=1",
    "https://api.example.com/#top",
    "https://api.example.com?",
    "not a url",
  ])("returns null for the apiUrl %s", async (apiUrl) => {
    const t = setup();
    expect(await t.call({ apiUrl })).toBeNull();
    expect(t.requests).toHaveLength(0);
    expect(t.logs[0]).toContain("apiUrl must be https://, or http:// on localhost");
  });

  test.each([
    ["https://api.submitator.com", "https://api.submitator.com"],
    ["https://API.Submitator.com///", "https://api.submitator.com"],
    ["http://localhost:3001/", "http://localhost:3001"],
    ["http://127.0.0.1:3001", "http://127.0.0.1:3001"],
    ["http://[::1]:3001", "http://[::1]:3001"],
    ["https://example.com/api/", "https://example.com/api"],
  ])("normalizes the apiUrl %s", (input, expected) => {
    expect(normalizeApiUrl(input)).toBe(expected);
  });

  test("asks for the wall at {apiUrl}/badge/{project}/wall/v1, project lowercased", async () => {
    const t = setup();
    await t.call({ apiUrl: "http://localhost:3001/api/", project: PROJECT.toUpperCase() });
    expect(t.requests[0]?.url).toBe(`http://localhost:3001/api/badge/${PROJECT}/wall/v1`);
  });

  test.each([
    ["no apiUrl", {}],
    ["the default apiUrl spelled with a slash", { apiUrl: "https://api.submitator.com/" }],
    ["the default host with a trailing dot", { apiUrl: "https://api.submitator.com." }],
    ["the default host in capitals", { apiUrl: "https://API.Submitator.com" }],
    ["the default host with a path", { apiUrl: "https://api.submitator.com/v1" }],
    ["the default host on another port", { apiUrl: "https://api.submitator.com:8443" }],
  ])("refuses publicKeys with %s", async (_label, options) => {
    const t = setup();
    expect(await t.client.fetchWall({ project: PROJECT, publicKeys: KEYS, ...options })).toBeNull();
    expect(t.requests).toHaveLength(0);
    expect(t.logs).toEqual([
      "[@submitator/badges] publicKeys works only with a custom apiUrl (a local or test backend): no badges are shown",
    ]);
  });

  test.each([
    ["an empty object", {}],
    ["a malformed key id", { "Local Key": KEYS["test-rfc8032-1"]! }],
    ["a key that is not 32 bytes", { "local-1": "abc" }],
  ])("refuses publicKeys with %s", async (_label, publicKeys) => {
    const t = setup();
    expect(await t.call({ publicKeys })).toBeNull();
    expect(t.logs[0]).toContain("publicKeys must map key ids");
  });

  test("uses the pinned keys without publicKeys, and they never accept the test key", async () => {
    const t = setup();
    expect(await t.client.fetchWall({ project: PROJECT, apiUrl: API })).toBeNull();
    expect(t.wallRequests()).toHaveLength(1);
    expect(t.logs[0]).toContain("test-rfc8032-1");
  });

  test("clamps revalidate to 15 to 60 seconds, warning once", async () => {
    const t = setup();
    await t.call({ revalidate: 5 });
    vi.advanceTimersByTime(14_999);
    await t.call({ revalidate: 5 });
    expect(t.wallRequests()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    await t.call({ revalidate: 5 });
    expect(t.wallRequests()).toHaveLength(2);
    expect(t.logs).toEqual(["[@submitator/badges] revalidate must be 15 to 60 seconds: using 15"]);
  });

  test("clamps revalidate above 60 and refuses a non-number", async () => {
    const t = setup();
    await t.call({ revalidate: 3600 });
    await t.call({ revalidate: "60" as unknown as number });
    expect(t.logs).toEqual([
      "[@submitator/badges] revalidate must be 15 to 60 seconds: using 60",
      "[@submitator/badges] revalidate must be a number of seconds: using 60",
    ]);
  });

  test.each([
    [50, 100, "using 100"],
    [60_000, 10_000, "using 10000"],
  ])("clamps timeout %i to %i ms", async (timeout, effective, note) => {
    const t = setup();
    t.replyWith(() => new Promise<ResponseLike>(() => undefined));
    const call = t.call({ timeout });
    await vi.advanceTimersByTimeAsync(effective - 1);
    let settled = false;
    void call.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await call).toBeNull();
    expect(t.logs[0]).toContain(note);
  });

  test("a silenced call does not use up a warning", async () => {
    const t = setup();
    await t.call({ project: "nope", log: false });
    await t.call({ project: "nope" });
    expect(t.logs).toHaveLength(1);
  });

  test("log: false silences every warning; a log function gets them", async () => {
    const quiet = setup();
    await quiet.call({ project: "nope", log: false });
    expect(quiet.logs).toEqual([]);
    const lines: string[] = [];
    const custom = setup();
    await custom.call({ project: "nope", log: (line) => lines.push(line) });
    expect(custom.logs).toEqual([]);
    expect(lines).toHaveLength(1);
  });
});

describe("the request", () => {
  test("is a GET with Accept and User-Agent only: no cookie, body or query, redirect manual", async () => {
    const signal = AbortSignal.timeout(10_000);
    const t = setup({ deadline: () => signal });
    await t.call();
    const [request] = t.requests;
    expect(request?.url).toBe(`${API}/badge/${PROJECT}/wall/v1`);
    expect(request?.init).toEqual({
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": `submitator-badges/${VERSION} (node; +https://submitator.com/badge-package)`,
      },
      redirect: "manual",
      signal,
    });
  });

  const sources: Array<[string, Partial<FetchWallOptions>, Partial<ClientEnv>, string]> = [
    ["the runtime", {}, {}, "node"],
    ["the framework option", { framework: "nuxt" }, {}, "nuxt"],
    ["Next.js when detected", {}, { isNext: () => true }, "next"],
    ["the option over Next.js", { framework: "react" }, { isNext: () => true }, "react"],
    ["the bun runtime", {}, { runtime: () => "bun" }, "bun"],
  ];
  test.each(sources)("names %s in the User-Agent", async (_label, options, env, framework) => {
    const t = setup(env);
    await t.call(options);
    const ua = t.wallRequests()[0]?.init.headers?.["User-Agent"] ?? "";
    const match = SERVER_UA.exec(ua);
    expect(match?.groups?.["version"]).toBe(VERSION);
    const tokens = (match?.groups?.["comment"] ?? "").split(";").map((token) => token.trim());
    expect(tokens).toEqual([framework, "+https://submitator.com/badge-package"]);
  });

  test("adds the dev token when NODE_ENV is development", async () => {
    const t = setup({ nodeEnv: () => "development" });
    await t.call({ framework: "sveltekit" });
    const ua = t.requests[0]?.init.headers?.["User-Agent"];
    expect(ua).toBe(
      `submitator-badges/${VERSION} (sveltekit; dev; +https://submitator.com/badge-package)`,
    );
    expect(SERVER_UA.test(ua ?? "")).toBe(true);
  });

  test("sends other, with one warning, for a framework outside the contract's list", async () => {
    const t = setup();
    await t.call({ framework: "remix" as unknown as "other" });
    expect(t.requests[0]?.init.headers?.["User-Agent"]).toContain("(other; +");
    expect(t.logs[0]).toContain("framework must be one of next, react, nuxt");
  });
});

describe("where it runs", () => {
  test("returns null in a browser, with no request and one warning", async () => {
    const t = setup({ isBrowser: () => true });
    expect(await t.call()).toBeNull();
    expect(await t.call()).toBeNull();
    expect(t.requests).toHaveLength(0);
    expect(t.logs).toEqual([
      "[@submitator/badges] fetchWall runs on your server only, so it returned null in the browser: render the badges in a Server Component, a server route or a load function",
    ]);
  });

  test("waits one macrotask before reading the clock", async () => {
    const order: string[] = [];
    const t = setup({
      macrotask: async () => {
        order.push("macrotask");
      },
      now: () => {
        order.push("now");
        return Date.now();
      },
      isNext: () => true,
      fetch: async (url) => {
        order.push(url.startsWith("data:") ? "mark" : "wall");
        return url.startsWith("data:")
          ? respond(200, [encoder.encode("submitator-wall")])
          : ok(envelopeFor());
      },
    });
    await t.call();
    expect(order.slice(0, 3)).toEqual(["macrotask", "mark", "now"]);
  });

  test("under Next.js marks every render with a data: fetch carrying next.revalidate", async () => {
    const t = setup({ isNext: () => true });
    await t.call({ revalidate: 15 });
    await t.call({ revalidate: 15 });
    expect(t.requests.map((request) => [request.url, request.init.next])).toEqual([
      ["data:text/plain,submitator-wall", { revalidate: 15 }],
      [`${API}/badge/${PROJECT}/wall/v1`, { revalidate: 15 }],
      ["data:text/plain,submitator-wall", { revalidate: 15 }],
    ]);
  });

  test("outside Next.js sends no mark and no next option", async () => {
    const t = setup();
    await t.call();
    expect(t.requests).toHaveLength(1);
    expect(t.requests[0]?.init).not.toHaveProperty("next");
  });

  test("a failing lifetime mark does not break the render", async () => {
    const t = setup({ isNext: () => true });
    t.replyWith((url) =>
      url.startsWith("data:") ? Promise.reject(new TypeError("unsupported")) : ok(envelopeFor()),
    );
    expect(await t.call()).not.toBeNull();
    expect(await t.call()).not.toBeNull();
    expect(t.logs).toEqual([
      "[@submitator/badges] could not give the Next.js page a lifetime: a page served from memory may stay as built until the next deploy",
    ]);
  });

  test("never throws, whatever fetch and the log function do", async () => {
    const t = setup({
      fetch: () => {
        throw new Error("sync failure");
      },
    });
    expect(
      await t.call({
        log: () => {
          throw new Error("log failure");
        },
      }),
    ).toBeNull();
    expect(await t.client.fetchWall(undefined as unknown as FetchWallOptions)).toBeNull();
    expect(await t.client.fetchWall(null as unknown as FetchWallOptions)).toBeNull();
  });
});

describe("the package's own fetchWall", () => {
  test("looks up globalThis.fetch on every call and shares memory through a global symbol", async () => {
    vi.useRealTimers();
    const project = "22222222-3333-4444-8555-666666666666";
    const fake = vi.fn(async () => ok(envelopeFor({ project })));
    vi.stubGlobal("fetch", fake);
    const wall: Wall | null = await fetchWall({
      project,
      apiUrl: API,
      publicKeys: KEYS,
      log: false,
    });
    expect(wall?.project).toBe(project);
    expect(fake).toHaveBeenCalledTimes(1);
    const store = (globalThis as unknown as Record<symbol, unknown>)[
      Symbol.for("submitator.badges.slots.v1")
    ];
    expect(store).toBeInstanceOf(Map);
    expect([...(store as Map<string, Slot>).keys()].some((key) => key.includes(project))).toBe(
      true,
    );
  });
});
