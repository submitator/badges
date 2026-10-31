// Runs twice: in the "vue" project (the latest Vue) and in "vue34", where
// vitest.config.ts points vue at the vue34 alias (Vue 3.4, the oldest Vue the
// package supports). The DOM is happy-dom, for hydration.
import { createSSRApp, h, version } from "vue";
import type { App } from "vue";
import { renderToString } from "vue/server-renderer";
import { describe, expect, inject, test } from "vitest";
import { BadgeWall } from "../../src/vue.js";
import type { Wall, WallRenderOptions } from "../../src/types.js";
import { describeWallRendering, wallNamed, WALLS } from "../support/render.js";

declare module "vitest" {
  export interface ProvidedContext {
    vueMinor: string;
  }
}

const minor = inject("vueMinor");

test(`runs on Vue ${minor}`, () => {
  expect(version.startsWith(`${minor}.`)).toBe(true);
});

/** An app that renders `<BadgeWall :wall :layout :nonce :class />`, as a page would. */
function app(
  wall: Wall | null | undefined,
  { layout, className, nonce }: WallRenderOptions = {},
  extra: Record<string, unknown> = {},
): App {
  return createSSRApp({
    render: () => h(BadgeWall, { wall, layout, nonce, class: className, ...extra }),
  });
}

describeWallRendering({
  render: (wall, options) => renderToString(app(wall, options)),
});

describe("hydration", () => {
  /** Server HTML in a container, then the same app hydrated over it. */
  async function hydrate(wall: Wall, options?: WallRenderOptions) {
    const container = document.createElement("div");
    container.innerHTML = await renderToString(app(wall, options));
    const serverHtml = container.innerHTML;
    const serverNodes = [...container.querySelectorAll("*")];
    app(wall, options).mount(container);
    return { container, serverHtml, serverNodes };
  }

  test.each([...WALLS.keys()])(
    "%s hydrates over the server HTML, changing nothing",
    async (name) => {
      const { container, serverHtml, serverNodes } = await hydrate(wallNamed(name), {
        className: "x",
        nonce: "n",
      });
      expect(container.innerHTML).toBe(serverHtml);
      const nodes = [...container.querySelectorAll("*")];
      expect(nodes.length).toBe(serverNodes.length);
      expect(nodes.every((node, index) => node === serverNodes[index])).toBe(true);
    },
  );

  test("svg, path and circle stay in the SVG namespace", async () => {
    const { container } = await hydrate(wallNamed("hand-retail"), { layout: "row" });
    const graphics = [...container.querySelectorAll("svg, path, circle")];
    expect(graphics.length).toBeGreaterThan(2);
    expect(new Set(graphics.map((node) => node.namespaceURI))).toEqual(
      new Set(["http://www.w3.org/2000/svg"]),
    );
  });
});

describe("attributes", () => {
  test("a class given as an array or an object lands on the root, like on any element", async () => {
    const html = await renderToString(
      app(
        wallNamed("hand-three-badges"),
        {},
        { class: ["footer", { badges: true, hidden: false }] },
      ),
    );
    expect(html).toMatch(/^<div class="sbm-wall sbm-wall-marquee footer badges" data-sbm-wall=/);
  });

  test("other attributes given to the component are dropped", async () => {
    const html = await renderToString(
      app(wallNamed("hand-two-badges"), {}, { id: "badges", onClick: () => undefined }),
    );
    expect(html).not.toMatch(/id="badges"|onclick/i);
  });
});
