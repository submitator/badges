// The README prints the canonical customer snippets byte for byte: the app's
// Configure Badges page and the landing's /badge-package page print the same
// texts and compare them with their own copy of README.snippets.md
// (test/fixtures/readme/ holds this repo's copy).
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const canon = read("test/fixtures/readme/README.snippets.md");
const readme = read("README.md");

const CODE_BLOCK = /^```[^\n]*\n[\s\S]*?^```$/gm;
/** Everything from the first snippet heading on; before it the file describes itself. */
const body = canon.slice(canon.indexOf("## Install"));

describe("README", () => {
  test("prints every canonical code block verbatim", () => {
    const blocks = body.match(CODE_BLOCK) ?? [];
    expect(blocks.length).toBeGreaterThanOrEqual(12);
    expect(blocks.filter((block) => !readme.includes(block))).toEqual([]);
  });

  test("prints every canonical paragraph verbatim", () => {
    const paragraphs = body
      .replace(CODE_BLOCK, "")
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph !== "" && !paragraph.startsWith("#"));
    expect(paragraphs.length).toBeGreaterThanOrEqual(4);
    expect(paragraphs.filter((paragraph) => !readme.includes(paragraph))).toEqual([]);
  });

  test("keeps the canonical headings and the placement line", () => {
    const headings = body.match(/^## .+$/gm) ?? [];
    const readmeHeadings = new Set(readme.match(/^## .+$/gm) ?? []);
    expect(headings.filter((heading) => !readmeHeadings.has(heading))).toEqual([]);
    const placement = /Placement line \(same words everywhere\): "([^"]+)"/.exec(
      canon.replace(/\n/g, " "),
    )?.[1];
    expect(placement).toBe(
      "Put the badges on your homepage, usually in its footer: that is the page directories check.",
    );
    expect(readme).toContain(placement);
  });

  test("names the contact address and the license holder", () => {
    expect(readme).toContain("vlad@submitator.com");
    expect(readme).toContain("Copyright (c) 2026 Adeptus Innovatio SL");
    expect(read("LICENSE")).toContain("Copyright (c) 2026 Adeptus Innovatio SL");
  });
});
