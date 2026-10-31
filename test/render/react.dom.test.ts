// @vitest-environment happy-dom
// Pages Router: BadgeWall's server HTML hydrates on the client with the wall
// from page props (so it came through JSON). Runs in the "react" project
// (React 19) and in "react18" (React 18.3).
import { act, createElement, version } from "react";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, inject, test, vi } from "vitest";
import type { MockInstance } from "vitest";
import { BadgeWall } from "../../src/react.js";
import type { Wall } from "../../src/types.js";
import { wallNamed, WALLS } from "../support/render.js";

const major = inject("reactMajor");
const actScope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

// React 19 reads a nonce back through the element's nonce property, as
// browsers hide the attribute; happy-dom has no such property yet.
if (!("nonce" in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, "nonce", {
    configurable: true,
    get(this: HTMLElement) {
      return this.getAttribute("nonce") ?? "";
    },
    set(this: HTMLElement, value: string) {
      this.setAttribute("nonce", value);
    },
  });
}

let container: HTMLElement;
let root: Root | null = null;
let errors: MockInstance<typeof console.error>;
let warnings: MockInstance<typeof console.warn>;

beforeEach(() => {
  actScope.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  if (root !== null) act(() => root?.unmount());
  root = null;
  container.remove();
  document.head.replaceChildren();
  errors.mockRestore();
  warnings.mockRestore();
});

test(`runs on React ${major}`, () => {
  expect(version.split(".")[0]).toBe(String(major));
});

test.each([...WALLS.keys()])("%s hydrates without a warning, changing nothing", async (name) => {
  const wall = wallNamed(name);
  const props = { className: "x", nonce: "n" };
  container.innerHTML = renderToString(createElement(BadgeWall, { wall, ...props }));
  // React 19 writes image preloads before the content; a page keeps them in its head.
  for (const link of container.querySelectorAll("link[rel=preload]")) document.head.append(link);
  const before = container.innerHTML;
  const serverNodes = [...container.querySelectorAll("*")];
  const recoverable: unknown[] = [];
  const fromProps = JSON.parse(JSON.stringify(wall)) as Wall;
  await act(async () => {
    root = hydrateRoot(container, createElement(BadgeWall, { wall: fromProps, ...props }), {
      onRecoverableError: (error) => recoverable.push(error),
    });
  });
  expect(recoverable).toEqual([]);
  expect([...errors.mock.calls, ...warnings.mock.calls]).toEqual([]);
  expect(container.innerHTML).toBe(before);
  const nodes = [...container.querySelectorAll("*")];
  expect(nodes.length).toBe(serverNodes.length);
  expect(nodes.every((node, index) => node === serverNodes[index])).toBe(true);
});

test("a wall that differs from the server's is reported (so the check above can fail)", async () => {
  const wall = wallNamed("hand-two-badges");
  container.innerHTML = renderToString(createElement(BadgeWall, { wall }));
  const recoverable: unknown[] = [];
  await act(async () => {
    root = hydrateRoot(
      container,
      createElement(BadgeWall, { wall, layout: "marquee", className: "y" }),
      {
        onRecoverableError: (error) => recoverable.push(error),
      },
    );
  });
  expect(recoverable.length + errors.mock.calls.length).toBeGreaterThan(0);
});
