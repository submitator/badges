import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { packedPaths, packProblems, REQUIRED } from "../../scripts/check-pack.mjs";
import { VERSION } from "../../src/version.js";

const root = new URL("../../", import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), "utf8");

/** Every file git tracks or would track (untracked files that are not ignored). */
function repoFiles(): string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  return out
    .split("\0")
    .filter((path) => path !== "" && existsSync(new URL(path, root)))
    .sort();
}

const BINARY = /\.(?:png|jpe?g|gif|webp|ico|woff2?|tgz|gz)$/i;
const textFiles = repoFiles().filter((path) => !BINARY.test(path));

// Built from code points and parts, so this file never contains what it bans.
const BACKSLASH = String.fromCharCode(92);
const LONG_DASHES = [String.fromCharCode(0x2013), String.fromCharCode(0x2014)];
const LONG_DASH_SPELLINGS = new RegExp(
  [
    "&" + "[mn]dash;",
    "&#" + "82(?:11|12);",
    "&#x" + "201[34];",
    BACKSLASH + BACKSLASH + "u201[34]",
    BACKSLASH + BACKSLASH + "u\\{201[34]\\}",
  ].join("|"),
  "i",
);
const ASSEMBLED_WORD = new RegExp(["badge", "feed"].join(""), "i");

describe("repo hygiene", () => {
  test("the scan sees the repo", () => {
    expect(textFiles).toContain("package.json");
    expect(textFiles).toContain("CONTRACT.md");
    expect(textFiles).toContain("src/index.ts");
    expect(textFiles).toContain("test/repo/hygiene.test.ts");
  });

  test("no long dash, written or escaped, in any text file", () => {
    const hits = textFiles.filter((path) => {
      const text = read(path);
      return LONG_DASHES.some((dash) => text.includes(dash)) || LONG_DASH_SPELLINGS.test(text);
    });
    expect(hits).toEqual([]);
  });

  test("the assembled word badge plus feed appears nowhere", () => {
    expect(textFiles.filter((path) => ASSEMBLED_WORD.test(read(path)))).toEqual([]);
  });

  test("no raw control character other than TAB, LF and CR in any text file", () => {
    const control = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
    expect(textFiles.filter((path) => control.test(read(path)))).toEqual([]);
  });

  test("src/version.ts matches package.json", () => {
    const { version } = JSON.parse(read("package.json")) as { version: string };
    expect(VERSION).toBe(version);
  });

  test("npm pack ships only dist, svelte, astro, README, LICENSE, CHANGELOG and package.json", () => {
    expect(packProblems(packedPaths(), { requireBuild: false })).toEqual([]);
  });

  test("the pack check refuses other paths, server segments and test keys", () => {
    const files: Record<string, string> = {
      "dist/index.js": "export {};",
      "dist/server/wall.js": "export {};",
      "dist/keys.js": 'export const K = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo";',
    };
    const problems = packProblems(["package.json", "src/index.ts", ...Object.keys(files)], {
      read: (path: string) => files[path] ?? "",
    });
    expect(problems.slice(0, 5)).toEqual([
      "not allowed in the tarball: src/index.ts",
      "path has a server segment: dist/server/wall.js",
      "test key material in dist/keys.js",
      "missing from the tarball: LICENSE",
      "missing from the tarball: CHANGELOG.md",
    ]);
    expect(problems).toContain("missing from the tarball: dist/index.d.ts");
  });

  test("every file the exports map points at must ship: core, React, Vue, Svelte and Astro", () => {
    expect(REQUIRED).toEqual(
      expect.arrayContaining([
        "dist/index.js",
        "dist/index.d.ts",
        "dist/react.js",
        "dist/react.d.ts",
        "dist/vue.js",
        "dist/vue.d.ts",
        "svelte/index.js",
        "svelte/index.d.ts",
        "astro/index.js",
        "astro/index.d.ts",
      ]),
    );
  });

  test("the pack check refuses a component source importing a file that is not shipped", () => {
    const files: Record<string, string> = {
      "svelte/index.js": 'export { default as BadgeWall } from "./BadgeWall.svelte";',
      "astro/Node.astro": '---\nimport { styleText } from "../dist/layout.js";\n---',
    };
    const shipped = [...new Set([...REQUIRED, ...Object.keys(files)])];
    expect(packProblems(shipped, { read: (path: string) => files[path] ?? "" })).toEqual([
      "svelte/index.js imports ./BadgeWall.svelte, which is not shipped",
      "astro/Node.astro imports ../dist/layout.js, which is not shipped",
    ]);
  });
});
