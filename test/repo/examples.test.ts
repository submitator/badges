// The tools of examples/: the mock wall server must serve walls the package
// accepts, and check-html.mjs must pass a good page and catch the faults it
// looks for. The example apps themselves run in CI (examples/run-example.mjs).
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { inspectPage, refCount, selfCheckCount } from "../../examples/check-html.mjs";
import { PROJECTS, PUBLIC_KEYS, expectedWall } from "../../examples/mock-wall-server/projects.mjs";
import { startMockServer } from "../../examples/mock-wall-server/server.mjs";
import { createClient, defaultEnv } from "../../src/client.js";
import { wallToHtml } from "../../src/html.js";
import type { Wall } from "../../src/types.js";

type Mock = Awaited<ReturnType<typeof startMockServer>>;

let mock: Mock;
beforeAll(async () => {
  mock = await startMockServer({ port: 0 });
});
afterAll(async () => {
  await mock.close();
});

/** fetchWall with fresh memory, against the mock. */
function fetchFromMock(project: string, timeout?: number): Promise<Wall | null> {
  const client = createClient({ ...defaultEnv, warn: () => undefined });
  return client.fetchWall({ project, apiUrl: mock.url, publicKeys: PUBLIC_KEYS, timeout });
}

const page = (body: string): string =>
  `<!doctype html>\n<html><head><title>t</title></head><body><main>Hi</main>\n<footer>${body}</footer></body></html>\n`;

describe("mock wall server", () => {
  test("serves a good wall that the package accepts, self badge first", async () => {
    const wall = await fetchFromMock(PROJECTS.good);
    expect(wall?.badges.map((badge) => badge.kind)).toEqual([
      "self",
      "directory",
      "directory",
      "directory",
      "directory",
      "custom",
      "custom",
    ]);
    expect(wall?.skipped).toBe(0);
  });

  test("gives no wall for a bad signature, a 503 or an expired wall", async () => {
    expect(await fetchFromMock(PROJECTS.badSignature)).toBeNull();
    expect(await fetchFromMock(PROJECTS.unavailable)).toBeNull();
    expect(await fetchFromMock(PROJECTS.expired)).toBeNull();
  });

  test("leaves out the one bad badge of project 0006", async () => {
    const wall = await fetchFromMock(PROJECTS.oneBadBadge);
    expect(wall?.skipped).toBe(1);
    expect(wall?.badges).toHaveLength(7);
  });

  test("signs a newer wall with one more badge after a bump", async () => {
    const before = await fetchFromMock(PROJECTS.good);
    const bump = await fetch(`${mock.url}/__bump?project=${PROJECTS.good}`, { method: "POST" });
    expect(await bump.json()).toEqual({ project: PROJECTS.good, host: "bumped.example.com" });
    const after = await fetchFromMock(PROJECTS.good);
    expect(after?.badges.at(-1)?.host).toBe("bumped.example.com");
    expect(after!.issuedAt > before!.issuedAt).toBe(true);
    await fetch(`${mock.url}/__reset`, { method: "POST" });
  });

  test("records each wall request with its User-Agent and no Origin or cookie", async () => {
    await fetch(`${mock.url}/__reset`, { method: "POST" });
    await fetchFromMock(PROJECTS.good);
    const requests = (await (await fetch(`${mock.url}/__requests`)).json()) as Array<
      Record<string, string | null>
    >;
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      project: PROJECTS.good,
      status: 200,
      accept: "application/json",
      origin: null,
      cookie: null,
    });
    expect(requests[0]?.["userAgent"]).toMatch(
      /^submitator-badges\/\S+ \(node; \+https:\/\/submitator\.com\/badge-package\)$/,
    );
  });

  test("answers 404 for an unknown project and for any other path", async () => {
    const unknown = await fetch(`${mock.url}/badge/00000000-0000-4000-8000-0000000000ff/wall/v1`);
    const suffix = await fetch(`${mock.url}/badge/${PROJECTS.good}/wall/v1.json`);
    expect([unknown.status, suffix.status]).toEqual([404, 404]);
  });
});

describe("check-html", () => {
  test("a page with the good wall passes every check, as marquee and as row", async () => {
    const wall = await fetchFromMock(PROJECTS.good);
    for (const layout of ["marquee", "row"] as const) {
      const html = page(wallToHtml(wall, { layout }));
      expect(
        inspectPage(html, { project: PROJECTS.good, expected: expectedWall() }).problems,
      ).toEqual([]);
    }
  });

  test("counts matching lines, as grep -c does", () => {
    const line = `<a data-sbm-ref="${PROJECTS.good}">a</a><a data-sbm-ref=${PROJECTS.good}>b</a>`;
    expect(selfCheckCount(`${line}\n${line}\nother`, PROJECTS.good)).toBe(2);
  });

  test("the self-check ignores a wall that only travels in hydration data", () => {
    const data = JSON.stringify({
      href: `https://submitator.com?ref=${PROJECTS.good}`,
      "data-sbm-ref": PROJECTS.good,
    });
    const html = page(`<script>self.__next_f.push([1,${JSON.stringify(data)}])</script>`);
    expect(selfCheckCount(html, PROJECTS.good)).toBe(0);
    expect(refCount(html, PROJECTS.good)).toBe(1);
    expect(inspectPage(html, { project: PROJECTS.good, negative: true }).problems).toEqual([]);
    expect(inspectPage(html, { project: PROJECTS.good }).problems).toContain(
      "the self-check finds 0: the badges are not in the server HTML",
    );
  });

  test("fails a client-only check when the wall is in the server HTML", async () => {
    const html = page(wallToHtml(await fetchFromMock(PROJECTS.good)));
    expect(inspectPage(html, { project: PROJECTS.good, negative: true }).problems).toHaveLength(2);
  });

  test("catches a loop copy link left in the tab order", async () => {
    const html = page(wallToHtml(await fetchFromMock(PROJECTS.good))).replace(' tabindex="-1"', "");
    expect(inspectPage(html, { project: PROJECTS.good }).problems).toEqual([
      expect.stringContaining("lacks tabindex=-1"),
    ]);
  });

  test("catches a directory link inside span.sbm-cb and a custom link outside it", async () => {
    const html = page(wallToHtml(await fetchFromMock(PROJECTS.good)))
      .replaceAll("https://turbo0.com/", "https://www.producthunt.com/")
      .replaceAll('href="https://www.g2.com/', 'href="https://turbo0.com/');
    const { problems } = inspectPage(html, { project: PROJECTS.good, expected: expectedWall() });
    expect(problems).toContain(
      "a link to the custom badge host producthunt.com sits outside span.sbm-cb",
    );
    expect(problems).toContain("no visible link to the directory turbo0.com outside span.sbm-cb");
  });

  test("catches a script inside the wall and a second style element", async () => {
    const html = page(
      wallToHtml(await fetchFromMock(PROJECTS.good)).replace(
        '<ul class="sbm-wall-list"',
        '<script></script><style></style><ul class="sbm-wall-list"',
      ),
    );
    expect(inspectPage(html, { project: PROJECTS.good }).problems).toEqual([
      "expected one style element, found 2",
      "a script element sits inside the wall",
    ]);
  });
});
