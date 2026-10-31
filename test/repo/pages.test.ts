// The served pages of the example apps (test/fixtures/contract-v1/pages/),
// which the backend vendors for its own checks: each must say what its
// manifest entry promises, read by the same check-html.mjs the apps run.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { APPS } from "../../examples/apps.mjs";
import { inspectPage } from "../../examples/check-html.mjs";
import { expectedWall } from "../../examples/mock-wall-server/projects.mjs";

interface PageEntry {
  file: string;
  framework: string;
  badge: "found" | "missing";
}

const pages = new URL("../fixtures/contract-v1/pages/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", pages), "utf8")) as {
  project: string;
  directoryHosts: string[];
  customHosts: string[];
  pages: Record<string, PageEntry>;
};

describe("example pages", () => {
  test("the manifest lists every example app and the good wall's hosts", () => {
    expect(Object.keys(manifest.pages).sort()).toEqual(Object.keys(APPS).sort());
    const wall = expectedWall();
    expect(manifest).toMatchObject({
      project: wall.project,
      directoryHosts: wall.directoryHosts,
      customHosts: wall.customHosts,
    });
  });

  test.each(Object.entries(manifest.pages))(
    "%s holds what its manifest entry says",
    (_name, page) => {
      const html = readFileSync(new URL(page.file, pages), "utf8");
      const found = page.badge === "found";
      const { problems } = inspectPage(html, {
        project: manifest.project,
        ...(found ? { expected: expectedWall() } : {}),
        negative: !found,
      });
      expect(problems).toEqual([]);
    },
  );
});
