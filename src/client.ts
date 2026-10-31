// fetchWall: memory per apiUrl, project and key set, refreshed in the
// background (stale-while-revalidate), one request at a time per project.
// - A render waits (up to `timeout`) only when no wall is in memory yet.
// - The last good wall stays until its expiresAt, through 503 (the kill
//   switch), 404, garbage and bad signatures.
// - After a failure the package waits 30 s, or what Retry-After asks (30 to 600 s).
// - Never throws, never runs in a browser, sends no cookie, body or query.

import { DEFAULT_API_URL, DOCS_URL, LIFETIME_MARK_URL, LOG_PREFIX, UA_PRODUCT } from "./brand.js";
import { CLIENT, DEFAULTS, FRAMEWORKS, KEY_ID_PATTERN, LIMITS } from "./contract.js";
import { PUBLIC_KEYS } from "./keys.js";
import { normalizeProject, parseWallDetailed, timestampMicros } from "./parse.js";
import type { Skip } from "./parse.js";
import { deadline, envValue, isBrowser, isNext, macrotask, runtimeName, sleep } from "./runtime.js";
import type { Sleep } from "./runtime.js";
import type { FetchWallOptions, Framework, Wall } from "./types.js";
import { decodePublicKey, verifyEnvelopeDetailed } from "./verify.js";
import { VERSION } from "./version.js";

/** The part of a fetch Response the client reads. */
export interface ResponseLike {
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  readonly body: ReadableStream<Uint8Array> | null;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** The init the client passes to fetch; `next` is read by Next.js only. */
export interface RequestInitLike {
  method?: "GET";
  headers?: Record<string, string>;
  redirect?: "manual";
  signal?: AbortSignal;
  next?: { revalidate: number };
}

/** Everything the client takes from its surroundings, injected so tests can drive it. */
export interface ClientEnv {
  fetch(url: string, init: RequestInitLike): Promise<ResponseLike>;
  now(): number;
  macrotask(): Promise<void>;
  sleep(ms: number): Sleep;
  deadline(ms: number): AbortSignal | undefined;
  isBrowser(): boolean;
  isNext(): boolean;
  nodeEnv(): string | undefined;
  runtime(): Framework;
  warn(message: string): void;
}

/** The real surroundings. fetch is looked up on every call, so Next.js's patched fetch is used. */
export const defaultEnv: ClientEnv = {
  fetch: (url, init) =>
    globalThis.fetch(url, init as RequestInit) as unknown as Promise<ResponseLike>,
  now: () => Date.now(),
  macrotask,
  sleep,
  deadline,
  isBrowser,
  isNext,
  nodeEnv: () => envValue("NODE_ENV"),
  runtime: runtimeName,
  warn: (message) => console.warn(message),
};

interface Memo {
  readonly keyId: string;
  readonly signature: string;
  readonly payload: string;
}

/** What the client keeps per apiUrl, project and key set. Bump the store symbol if this changes. */
export interface Slot {
  wall: Wall | null;
  expiresAtMs: number;
  issuedAtMicros: bigint;
  memo: Memo | null;
  fetchedAt: number | null;
  failedAt: number | null;
  backoffMs: number;
  pending: Promise<void> | null;
  pendingSince: number;
  pendingToken: object | null;
  warned: Set<string>;
  skippedWarned: number;
}

type Sink = ((message: string) => void) | null;

interface Options {
  readonly project: string;
  readonly base: string;
  readonly url: string;
  readonly keys: Readonly<Record<string, string>>;
  readonly slotKey: string;
  readonly revalidateSeconds: number;
  readonly timeoutMs: number;
  readonly framework: Framework;
  readonly dev: boolean;
  readonly next: boolean;
  readonly sink: Sink;
}

type Outcome =
  | {
      readonly ok: true;
      readonly fresh: {
        wall: Wall;
        expiresAtMs: number;
        issuedAtMicros: bigint;
        memo: Memo;
        skips: readonly Skip[];
      } | null;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly detail: string;
      readonly backoffMs: number;
    };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Strips trailing slashes and checks the apiUrl rules of CONTRACT.md section 1. */
export function normalizeApiUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.includes("?") || text.includes("#")) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.username !== "" || url.password !== "") return null;
  if (url.protocol === "http:") {
    if (!LOCAL_HOSTS.has(url.hostname)) return null;
  } else if (url.protocol !== "https:") {
    return null;
  }
  return url.origin + url.pathname.replace(/\/+$/, "");
}

/** The User-Agent of CONTRACT.md section 1. */
export function userAgent(framework: Framework, dev: boolean): string {
  return `${UA_PRODUCT}/${VERSION} (${framework}${dev ? "; dev" : ""}; +${DOCS_URL})`;
}

/** Milliseconds a Retry-After header asks for, kept within 30 s to 600 s. */
export function retryAfterMs(value: string | null, now: number): number {
  if (value === null) return CLIENT.failureBackoffMs;
  const text = value.trim();
  let ms: number;
  if (/^\d+$/.test(text)) {
    ms = Number(text) * 1000;
  } else {
    const date = Date.parse(text);
    if (Number.isNaN(date)) return CLIENT.failureBackoffMs;
    ms = date - now;
  }
  return Math.min(CLIENT.retryAfterMaxMs, Math.max(CLIENT.failureBackoffMs, ms));
}

/** Time since `then`; a clock that went backwards counts as a long time. */
function elapsed(now: number, then: number): number {
  return now >= then ? now - then : Number.POSITIVE_INFINITY;
}

/**
 * Whether a verified wall takes the place of the one in memory. A wall with an
 * older issuedAt never does (an older copy from a cache or another server),
 * unless the one in memory is stamped more than 10 minutes ahead of this
 * clock: one wall from a server clock running fast must not hold every later
 * wall back until it expires.
 */
function replaces(slot: Slot, issuedAtMicros: bigint, now: number): boolean {
  if (slot.wall === null || issuedAtMicros >= slot.issuedAtMicros) return true;
  const latestTrusted = (BigInt(Math.floor(now)) + BigInt(CLIENT.clockSkewMs)) * 1000n;
  return slot.issuedAtMicros > latestTrusted;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function discard(response: ResponseLike): void {
  try {
    response.body?.cancel().catch(() => undefined);
  } catch {
    // Nothing left to free.
  }
}

/** Reads a body up to the 1 MiB cap; null when it is larger. */
async function readCapped(response: ResponseLike): Promise<Uint8Array | null> {
  const length = response.headers.get("content-length");
  if (length !== null && /^\d+$/.test(length.trim()) && Number(length) > LIMITS.bodyBytes) {
    discard(response);
    return null;
  }
  if (response.body === null) {
    const whole = new Uint8Array(await response.arrayBuffer());
    return whole.length > LIMITS.bodyBytes ? null : whole;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITS.bodyBytes) {
      reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** The three envelope fields when the body has exactly that shape. */
function envelopeFields(body: unknown): Memo | null {
  if (!isObject(body)) return null;
  const keys = Object.keys(body);
  const { payload, signature, keyId } = body;
  if (keys.length !== 3) return null;
  if (typeof payload !== "string" || typeof signature !== "string" || typeof keyId !== "string") {
    return null;
  }
  return { payload, signature, keyId };
}

const HINTS: Record<string, string> = {
  key: "update @submitator/badges, or check apiUrl and publicKeys",
  crypto: "render the badges from Node.js 20.9+, Bun, Deno or Cloudflare Workers",
};

function skippedSummary(skips: readonly Skip[]): string {
  const reasons = [...new Set(skips.map((skip) => skip.reason))].join(", ");
  const count = skips.length === 1 ? "1 badge was" : `${skips.length} badges were`;
  return `${count} left out because they failed the checks (${reasons}): the others are shown`;
}

export interface Client {
  fetchWall(options: FetchWallOptions): Promise<Wall | null>;
}

/**
 * The fetchWall logic over injected surroundings. `slots` is the memory; the
 * package's own fetchWall shares one through a global symbol.
 */
export function createClient(env: ClientEnv, slots: Map<string, Slot> = new Map()): Client {
  const warnedOnce = new Set<string>();

  function emit(sink: Sink, message: string): void {
    if (sink === null) return;
    try {
      sink(`${LOG_PREFIX} ${message}`);
    } catch {
      // A log function that throws must not break the page.
    }
  }

  /** Logs a message once per client. A silenced call does not use it up. */
  function once(sink: Sink, key: string, message: string): void {
    if (sink === null || warnedOnce.has(key)) return;
    warnedOnce.add(key);
    emit(sink, message);
  }

  function sinkFor(log: unknown): Sink {
    if (log === false) return null;
    if (typeof log === "function") return log as (message: string) => void;
    return env.warn;
  }

  function clamp(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
    name: string,
    unit: string,
    sink: Sink,
  ): number {
    if (value === undefined) return fallback;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      once(sink, `${name}:invalid`, `${name} must be a number of ${unit}: using ${fallback}`);
      return fallback;
    }
    if (value < min || value > max) {
      const clamped = Math.min(max, Math.max(min, value));
      once(sink, `${name}:range`, `${name} must be ${min} to ${max} ${unit}: using ${clamped}`);
      return clamped;
    }
    return value;
  }

  function normalize(input: FetchWallOptions, sink: Sink): Options | null {
    const project = normalizeProject(input.project);
    if (project === null) {
      once(
        sink,
        "project",
        "project must be your project's public id, a UUID: no badges are shown",
      );
      return null;
    }
    const base = normalizeApiUrl(input.apiUrl ?? DEFAULT_API_URL);
    if (base === null) {
      once(
        sink,
        "apiUrl",
        "apiUrl must be https://, or http:// on localhost, with no credentials, query or hash: no badges are shown",
      );
      return null;
    }

    let keys: Readonly<Record<string, string>> = PUBLIC_KEYS;
    let keySet = "default";
    if (input.publicKeys !== undefined) {
      if (base === DEFAULT_API_URL) {
        once(
          sink,
          "publicKeys:default",
          "publicKeys works only with a custom apiUrl (a local or test backend): no badges are shown",
        );
        return null;
      }
      const entries = isObject(input.publicKeys) ? Object.entries(input.publicKeys) : [];
      const valid =
        entries.length > 0 &&
        entries.every(([id, value]) => KEY_ID_PATTERN.test(id) && decodePublicKey(value) !== null);
      if (!valid) {
        once(
          sink,
          "publicKeys:invalid",
          "publicKeys must map key ids to 43-character base64url Ed25519 public keys: no badges are shown",
        );
        return null;
      }
      entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      keys = Object.freeze(Object.fromEntries(entries) as Record<string, string>);
      keySet = JSON.stringify(entries);
    }

    const revalidateSeconds = clamp(
      input.revalidate,
      DEFAULTS.revalidateSeconds,
      CLIENT.revalidateMinSeconds,
      CLIENT.revalidateMaxSeconds,
      "revalidate",
      "seconds",
      sink,
    );
    const timeoutMs = clamp(
      input.timeout,
      DEFAULTS.timeoutMs,
      CLIENT.timeoutMinMs,
      CLIENT.timeoutMaxMs,
      "timeout",
      "milliseconds",
      sink,
    );

    const next = env.isNext();
    let framework: Framework;
    if (input.framework === undefined) {
      framework = next ? "next" : env.runtime();
    } else if ((FRAMEWORKS as readonly unknown[]).includes(input.framework)) {
      framework = input.framework;
    } else {
      once(sink, "framework", `framework must be one of ${FRAMEWORKS.join(", ")}: sending other`);
      framework = "other";
    }

    return {
      project,
      base,
      url: `${base}/badge/${project}/wall/v1`,
      keys,
      slotKey: `${base}\n${project}\n${keySet}`,
      revalidateSeconds,
      timeoutMs,
      framework,
      dev: env.nodeEnv() === "development",
      next,
      sink,
    };
  }

  function slotFor(key: string): Slot {
    const existing = slots.get(key);
    if (existing !== undefined) {
      slots.delete(key);
      slots.set(key, existing);
      return existing;
    }
    const slot: Slot = {
      wall: null,
      expiresAtMs: 0,
      issuedAtMicros: 0n,
      memo: null,
      fetchedAt: null,
      failedAt: null,
      backoffMs: 0,
      pending: null,
      pendingSince: 0,
      pendingToken: null,
      warned: new Set(),
      skippedWarned: 0,
    };
    slots.set(key, slot);
    while (slots.size > CLIENT.maxSlots) {
      const oldest = slots.keys().next();
      if (oldest.done === true) break;
      slots.delete(oldest.value);
    }
    return slot;
  }

  /** Under Next.js, gives the page a lifetime of at most `revalidate`, with no network traffic. */
  async function markLifetime(options: Options): Promise<void> {
    try {
      const response = await env.fetch(LIFETIME_MARK_URL, {
        next: { revalidate: options.revalidateSeconds },
      });
      discard(response);
    } catch {
      once(
        options.sink,
        "mark",
        "could not give the Next.js page a lifetime: a page served from memory may stay as built until the next deploy",
      );
    }
  }

  function failure(reason: string, detail: string, backoffMs = CLIENT.failureBackoffMs): Outcome {
    return { ok: false, reason, detail, backoffMs };
  }

  async function load(slot: Slot, options: Options): Promise<Outcome> {
    const init: RequestInitLike = {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent(options.framework, options.dev),
      },
      redirect: "manual",
    };
    const signal = env.deadline(CLIENT.requestDeadlineMs);
    if (signal !== undefined) init.signal = signal;
    if (options.next) init.next = { revalidate: options.revalidateSeconds };

    let response: ResponseLike;
    try {
      response = await env.fetch(options.url, init);
    } catch (error) {
      const name = isObject(error) || error instanceof Error ? String(error.name) : "";
      if (name === "TimeoutError" || name === "AbortError") {
        return failure("timeout", `${options.base} did not answer within 10 seconds`);
      }
      return failure("network", `could not reach ${options.base}`);
    }

    if (response.status !== 200) {
      discard(response);
      const retry =
        response.status === 503 || response.status === 429
          ? retryAfterMs(response.headers.get("retry-after"), env.now())
          : CLIENT.failureBackoffMs;
      return failure("http", `the badge server answered ${response.status}`, retry);
    }

    let bytes: Uint8Array | null;
    try {
      bytes = await readCapped(response);
    } catch {
      return failure("network", `the answer from ${options.base} was cut off`);
    }
    if (bytes === null) return failure("too_large", "the answer is over 1 MiB");

    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      return failure("json", "the answer is not JSON");
    }

    const fields = envelopeFields(body);
    const memo = slot.memo;
    if (
      fields !== null &&
      memo !== null &&
      fields.keyId === memo.keyId &&
      fields.signature === memo.signature &&
      fields.payload === memo.payload
    ) {
      // The same signed wall as last time: no need to check it again, only its age.
      if (slot.wall !== null && env.now() < slot.expiresAtMs) return { ok: true, fresh: null };
      return failure("expired", "the wall has expired");
    }

    const verified = await verifyEnvelopeDetailed(body, options.keys);
    if (!verified.ok) return failure(verified.reason, verified.detail);
    const parsed = parseWallDetailed(verified.payload, {
      project: options.project,
      now: env.now(),
    });
    if (!parsed.ok) return failure(parsed.reason, parsed.detail);
    return {
      ok: true,
      fresh: {
        wall: parsed.wall,
        expiresAtMs: parsed.expiresAtMs,
        issuedAtMicros: timestampMicros(parsed.wall.issuedAt) ?? 0n,
        memo: { keyId: verified.keyId, signature: verified.signature, payload: verified.payload },
        skips: parsed.skips,
      },
    };
  }

  async function refresh(slot: Slot, options: Options, token: object): Promise<void> {
    let outcome: Outcome;
    try {
      outcome = await load(slot, options);
    } catch {
      outcome = failure("network", "the request failed");
    }
    const now = env.now();
    if (outcome.ok) {
      const fresh = outcome.fresh;
      if (fresh !== null && replaces(slot, fresh.issuedAtMicros, now)) {
        slot.wall = fresh.wall;
        slot.expiresAtMs = fresh.expiresAtMs;
        slot.issuedAtMicros = fresh.issuedAtMicros;
        slot.memo = fresh.memo;
        if (fresh.wall.skipped > 0 && fresh.wall.skipped !== slot.skippedWarned) {
          emit(options.sink, skippedSummary(fresh.skips));
        }
        slot.skippedWarned = fresh.wall.skipped;
      }
      slot.fetchedAt = now;
      slot.failedAt = null;
      slot.backoffMs = 0;
      slot.warned.clear();
      return;
    }
    if (slot.pendingToken !== token) return;
    slot.failedAt = now;
    slot.backoffMs = outcome.backoffMs;
    if (options.sink !== null && !slot.warned.has(outcome.reason)) {
      slot.warned.add(outcome.reason);
      const alive = slot.wall !== null && now < slot.expiresAtMs;
      const hint =
        HINTS[outcome.reason] ??
        (alive
          ? "the last good badges stay up until they expire"
          : "no badges are shown until a refresh works");
      emit(options.sink, `${outcome.detail}: ${hint}`);
    }
  }

  function startRefresh(slot: Slot, options: Options, now: number): void {
    const token = {};
    slot.pendingToken = token;
    slot.pendingSince = now;
    slot.pending = refresh(slot, options, token).finally(() => {
      if (slot.pendingToken === token) {
        slot.pending = null;
        slot.pendingToken = null;
      }
    });
  }

  async function run(input: FetchWallOptions): Promise<Wall | null> {
    const sink = sinkFor(isObject(input) ? input.log : undefined);
    if (env.isBrowser()) {
      once(
        sink,
        "browser",
        "fetchWall runs on your server only, so it returned null in the browser: render the badges in a Server Component, a server route or a load function",
      );
      return null;
    }
    if (!isObject(input)) {
      once(sink, "options", "fetchWall needs an options object with your project id");
      return null;
    }
    const options = normalize(input, sink);
    if (options === null) return null;

    // Read no clock before this task boundary. In a Next.js 16 prerender, a clock
    // read before any uncached I/O fails with blocking-prerender-current-time.
    await env.macrotask();
    if (options.next) await markLifetime(options);

    const now = env.now();
    const slot = slotFor(options.slotKey);
    if (
      slot.pending !== null &&
      elapsed(now, slot.pendingSince) > CLIENT.requestDeadlineMs + CLIENT.stuckGraceMs
    ) {
      // A frozen serverless instance never finished this request.
      slot.pending = null;
      slot.pendingToken = null;
    }

    const stale =
      slot.wall === null ||
      slot.fetchedAt === null ||
      now >= slot.expiresAtMs ||
      elapsed(now, slot.fetchedAt) >= options.revalidateSeconds * 1000;
    const backingOff = slot.failedAt !== null && elapsed(now, slot.failedAt) < slot.backoffMs;
    if (stale && slot.pending === null && !backingOff) startRefresh(slot, options, now);

    if (slot.wall !== null && now < slot.expiresAtMs) return slot.wall;
    if (slot.pending === null) return null;

    const timer = env.sleep(options.timeoutMs);
    try {
      await Promise.race([slot.pending, timer.promise]);
    } finally {
      timer.cancel();
    }
    return slot.wall !== null && env.now() < slot.expiresAtMs ? slot.wall : null;
  }

  return {
    async fetchWall(options: FetchWallOptions): Promise<Wall | null> {
      try {
        return await run(options);
      } catch {
        let sink: Sink = null;
        try {
          sink = sinkFor(isObject(options) ? options.log : undefined);
        } catch {
          sink = null;
        }
        once(sink, "unexpected", "fetchWall failed unexpectedly: no badges are shown");
        return null;
      }
    },
  };
}

const STORE = Symbol.for("submitator.badges.slots.v1");

/** The memory every copy of the package in this process shares (bundler duplicates, HMR). */
function sharedSlots(): Map<string, Slot> {
  const scope = globalThis as unknown as Record<symbol, Map<string, Slot> | undefined>;
  let store = scope[STORE];
  if (!(store instanceof Map)) {
    store = new Map();
    scope[STORE] = store;
  }
  return store;
}

let shared: Client | null = null;

/**
 * Fetches, verifies and checks your project's badge wall, from memory when it
 * can. Resolves to the wall, or null when there is none to show. Never throws.
 * Returns null in a browser: render the badges on your server.
 */
export function fetchWall(options: FetchWallOptions): Promise<Wall | null> {
  try {
    shared ??= createClient(defaultEnv, sharedSlots());
    return shared.fetchWall(options);
  } catch {
    return Promise.resolve(null);
  }
}
