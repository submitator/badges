// Svelte 5 in the browser (happy-dom): mounting, and hydrating the HTML the
// server rendered. The server HTML comes from a second Vite server that
// builds the same components for the server with the same Svelte plugin.
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { flushSync, hydrate, mount, unmount } from "svelte";
import { createServer } from "vite";
import type { ViteDevServer } from "vite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { MockInstance } from "vitest";
import { wallToHtml } from "../../src/html.js";
import type { Wall, WallRenderOptions } from "../../src/types.js";
import { BadgeWall } from "../../svelte/index.js";
import { distToSource, noSveltePrebundle } from "../support/aliases.js";
import { shape, wallNamed, wallRoot, WALLS } from "../support/render.js";

const SVG = "http://www.w3.org/2000/svg";
const XHTML = "http://www.w3.org/1999/xhtml";

interface Props {
  wall: Wall | null | undefined;
  layout?: WallRenderOptions["layout"];
  class?: string;
  nonce?: string;
}

let server: ViteDevServer;

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [noSveltePrebundle(), svelte({ configFile: false })],
    resolve: { alias: [distToSource] },
  });
});

afterAll(async () => {
  await server?.close();
});

/** The HTML SvelteKit would send for these props. */
async function serverHtml(props: Props): Promise<string> {
  const { render } = (await server.ssrLoadModule(
    "svelte/server",
  )) as typeof import("svelte/server");
  const entry = (await server.ssrLoadModule(
    "/svelte/index.js",
  )) as typeof import("../../svelte/index.js");
  return render(entry.BadgeWall, { props }).body;
}

let target: HTMLElement;
let mounted: Record<string, unknown> | null = null;
let warnings: MockInstance<typeof console.warn>;
let errors: MockInstance<typeof console.error>;

beforeEach(() => {
  target = document.createElement("div");
  document.body.append(target);
  warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  if (mounted !== null) unmount(mounted);
  mounted = null;
  target.remove();
  warnings.mockRestore();
  errors.mockRestore();
});

const logged = () => [...warnings.mock.calls, ...errors.mock.calls].map((call) => String(call[0]));

describe("mount", () => {
  test("svg, path and circle are created in the SVG namespace, the rest in HTML", () => {
    mounted = mount(BadgeWall, {
      target,
      props: { wall: wallNamed("hand-retail"), layout: "row" },
    });
    flushSync();
    const graphics = [...target.querySelectorAll("svg, path, circle")];
    expect(graphics.length).toBeGreaterThan(2);
    expect(new Set(graphics.map((node) => node.namespaceURI))).toEqual(new Set([SVG]));
    const html = [...target.querySelectorAll("div, ul, li, a, span, img, style")];
    expect(new Set(html.map((node) => node.namespaceURI))).toEqual(new Set([XHTML]));
    expect(logged()).toEqual([]);
  });

  // Styles go through style.cssText on the client, which the DOM rewrites in
  // its own spelling: hydration (below) keeps the server's style attributes.
  test.each([...WALLS.keys()])("%s: the same elements as wallToHtml, styles aside", (name) => {
    const wall = wallNamed(name);
    mounted = mount(BadgeWall, { target, props: { wall, class: "x", nonce: "n" } });
    flushSync();
    expect(shape(wallRoot(target.innerHTML), "ignore")).toEqual(
      shape(wallRoot(wallToHtml(wall, { className: "x", nonce: "n" })), "ignore"),
    );
    expect(logged()).toEqual([]);
  });

  test("renders nothing for null", () => {
    mounted = mount(BadgeWall, { target, props: { wall: null } });
    flushSync();
    expect(target.children).toHaveLength(0);
  });
});

describe("hydration", () => {
  test.each([...WALLS.keys()])("%s hydrates without a warning, changing nothing", async (name) => {
    const props: Props = { wall: wallNamed(name), class: "x", nonce: "n" };
    target.innerHTML = await serverHtml(props);
    const before = target.innerHTML;
    const serverNodes = [...target.querySelectorAll("*")];
    mounted = hydrate(BadgeWall, { target, props });
    flushSync();
    expect(logged()).toEqual([]);
    expect(target.innerHTML).toBe(before);
    const nodes = [...target.querySelectorAll("*")];
    expect(nodes.length).toBe(serverNodes.length);
    expect(nodes.every((node, index) => node === serverNodes[index])).toBe(true);
  });

  test("anchors hold exactly the text of wallToHtml: the templates add no whitespace", async () => {
    const wall = wallNamed("hand-retail");
    target.innerHTML = await serverHtml({ wall });
    mounted = hydrate(BadgeWall, { target, props: { wall } });
    flushSync();
    const reference = document.createElement("div");
    reference.innerHTML = wallToHtml(wall);
    const texts = (root: Element) => [...root.querySelectorAll("a")].map((a) => a.textContent);
    expect(texts(target).length).toBeGreaterThan(20);
    expect(texts(target)).toEqual(texts(reference));
  });

  test("an image that changed between server and client is reported (so the checks above can fail)", async () => {
    const server = wallNamed("hand-two-badges");
    const client = JSON.parse(
      JSON.stringify(server).replace("badge-listed-light.svg", "badge-listed-dark.svg"),
    ) as Wall;
    target.innerHTML = await serverHtml({ wall: server });
    mounted = hydrate(BadgeWall, { target, props: { wall: client } });
    flushSync();
    expect(logged().join("\n")).toMatch(/hydration_attribute_changed/);
  });
});
