import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { changelogSection } from "../../scripts/changelog-section.mjs";
import { sourceVersion, tagProblems } from "../../scripts/check-tag.mjs";
import { distTag } from "../../scripts/dist-tag.mjs";

const read = (path: string): string =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("release scripts", () => {
  test("check-tag passes a tag that names the package and source version", () => {
    expect(tagProblems("v1.2.3", "1.2.3", "1.2.3")).toEqual([]);
    expect(tagProblems("v1.3.0-rc.1", "1.3.0-rc.1", "1.3.0-rc.1")).toEqual([]);
  });

  test.each([
    ["1.2.3", "1.2.3", "1.2.3"],
    ["v1.2", "1.2.3", "1.2.3"],
    ["v1.2.4", "1.2.3", "1.2.3"],
    ["v1.2.3", "1.2.3", "1.2.2"],
    [undefined, "1.2.3", "1.2.3"],
  ])("check-tag refuses tag %s for package %s and source %s", (tag, version, source) => {
    expect(tagProblems(tag, version, source)).not.toEqual([]);
  });

  test("check-tag reads the version the build writes", () => {
    const { version } = JSON.parse(read("package.json")) as { version: string };
    expect(sourceVersion(read("src/version.ts"))).toBe(version);
  });

  test("dist-tag: next for a prerelease, latest otherwise", () => {
    expect(distTag("1.0.0")).toBe("latest");
    expect(distTag("1.1.0-rc.1")).toBe("next");
  });

  test("changelog-section prints one version's entries and nothing for a missing one", () => {
    const changelog = [
      "# Changelog",
      "",
      "## Unreleased",
      "",
      "## 1.1.0 (2026-12-01)",
      "",
      "- New layout.",
      "",
      "## 1.0.0",
      "",
      "- First version.",
      "",
    ].join("\n");
    expect(changelogSection(changelog, "1.1.0")).toBe("- New layout.");
    expect(changelogSection(changelog, "1.0.0")).toBe("- First version.");
    expect(changelogSection(changelog, "1.0.1")).toBeNull();
    expect(changelogSection("## 1.0.0\n\n## 0.9.0\n- x", "1.0.0")).toBeNull();
    expect(changelogSection("## 10.0.0\n- y", "1.0.0")).toBeNull();
  });
});
