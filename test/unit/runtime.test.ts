import { afterEach, describe, expect, test, vi } from "vitest";
import {
  deadline,
  envValue,
  isBrowser,
  isNext,
  macrotask,
  runtimeName,
  sleep,
} from "../../src/runtime.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("runtime detection", () => {
  test("names Node.js by default", () => {
    expect(runtimeName()).toBe("node");
  });

  test.each([
    ["bun", "Bun", {}],
    ["deno", "Deno", {}],
    ["workerd", "navigator", { userAgent: "Cloudflare-Workers" }],
    ["edge", "EdgeRuntime", "edge-runtime"],
  ])("names %s from its global", (name, global, value) => {
    vi.stubGlobal(global, value);
    expect(runtimeName()).toBe(name);
  });

  test("names the Next.js edge runtime", () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    expect(runtimeName()).toBe("edge");
  });

  test("spots Next.js by NEXT_RUNTIME or its patched fetch", () => {
    expect(isNext()).toBe(false);
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    expect(isNext()).toBe(true);
    vi.unstubAllEnvs();
    vi.stubGlobal(
      "fetch",
      Object.assign(async () => new Response(), { __nextPatched: true }),
    );
    expect(isNext()).toBe(true);
  });

  test("reads NODE_ENV", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(envValue("NODE_ENV")).toBe("development");
  });

  test("is a browser only where document exists", () => {
    expect(isBrowser()).toBe(false);
    vi.stubGlobal("document", {});
    expect(isBrowser()).toBe(true);
  });
});

describe("timers", () => {
  test("macrotask resolves after a zero-delay timer", async () => {
    vi.useFakeTimers();
    let done = false;
    void macrotask().then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });

  test("sleep resolves after its time and never once cancelled", async () => {
    vi.useFakeTimers();
    const fired: string[] = [];
    const kept = sleep(100);
    const cancelled = sleep(100);
    void kept.promise.then(() => fired.push("kept"));
    void cancelled.promise.then(() => fired.push("cancelled"));
    cancelled.cancel();
    await vi.advanceTimersByTimeAsync(100);
    expect(fired).toEqual(["kept"]);
  });

  test("deadline gives an AbortSignal that fires", async () => {
    const signal = deadline(5);
    expect(signal).toBeInstanceOf(AbortSignal);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(signal?.aborted).toBe(true);
  });
});
