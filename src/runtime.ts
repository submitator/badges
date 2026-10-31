// What the package knows about where it runs. It reads two environment
// variables and nothing else: NODE_ENV (to mark requests from development
// servers) and NEXT_RUNTIME (to spot Next.js). No secret, no configuration.

import type { Framework } from "./types.js";

// Declared here, so the build needs no Node.js types; undefined outside Node-like runtimes.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> } | undefined;

/** A timer that can be cancelled; it never keeps a Node.js process alive. */
export interface Sleep {
  readonly promise: Promise<void>;
  cancel(): void;
}

/** Reads NODE_ENV or NEXT_RUNTIME. Spelled out, so bundlers that inline them can. */
export function envValue(name: "NODE_ENV" | "NEXT_RUNTIME"): string | undefined {
  try {
    if (typeof process === "undefined" || !process) return undefined;
    return name === "NODE_ENV" ? process.env.NODE_ENV : process.env.NEXT_RUNTIME;
  } catch {
    // Deno without --allow-env throws on env access.
    return undefined;
  }
}

/** True in a browser (CONTRACT.md section 1): the package never fetches there. */
export function isBrowser(): boolean {
  return typeof document !== "undefined";
}

/** True under Next.js: its server sets NEXT_RUNTIME and patches fetch. */
export function isNext(): boolean {
  if (envValue("NEXT_RUNTIME")) return true;
  const patched = (globalThis as { fetch?: { __nextPatched?: unknown } }).fetch;
  return patched?.__nextPatched === true;
}

/** The runtime's User-Agent token when neither the option nor an adapter names one. */
export function runtimeName(): Framework {
  const scope = globalThis as Record<string, unknown>;
  if (scope["Bun"] !== undefined) return "bun";
  if (scope["Deno"] !== undefined) return "deno";
  const navigatorLike = scope["navigator"] as { userAgent?: unknown } | undefined;
  if (navigatorLike?.userAgent === "Cloudflare-Workers") return "workerd";
  if (typeof scope["EdgeRuntime"] === "string" || envValue("NEXT_RUNTIME") === "edge") {
    return "edge";
  }
  const processLike = scope["process"] as { versions?: { node?: unknown } } | undefined;
  if (typeof processLike?.versions?.node === "string") return "node";
  return "other";
}

/** Resolves after the current task: `setTimeout(0)`, the boundary Next.js inserts itself. */
export function macrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function unref(timer: unknown): void {
  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    const method = (timer as { unref: unknown }).unref;
    if (typeof method === "function") method.call(timer);
  }
}

/** Resolves after `ms`, or never once cancelled. */
export function sleep(ms: number): Sleep {
  let timer: unknown;
  const promise = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
    unref(timer);
  });
  return {
    promise,
    cancel: () => clearTimeout(timer as Parameters<typeof clearTimeout>[0]),
  };
}

/** An AbortSignal that fires after `ms`, where the runtime has AbortSignal.timeout. */
export function deadline(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") {
    return undefined;
  }
  return AbortSignal.timeout(ms);
}
