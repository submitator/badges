import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { changelogSection } from "../../scripts/changelog-section.mjs";
import { sourceVersion, tagProblems } from "../../scripts/check-tag.mjs";
import { SERVER_VERSION, versionProblems } from "../../scripts/check-version.mjs";
import { distTag } from "../../scripts/dist-tag.mjs";

const read = (path: string): string =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("release guards", () => {
  // npm stage publish packs the folder like npm publish, which runs prepublishOnly first.
  test("npm publish and npm stage publish check the keys and the version first", () => {
    const { scripts } = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(scripts["prepublishOnly"]).toBe(
      "node scripts/check-keys.mjs && node scripts/check-version.mjs",
    );
  });

  test("check-version holds the version to the server's grammar (CONTRACT.md section 9)", () => {
    expect(read("CONTRACT.md")).toContain(`(?<version>${SERVER_VERSION})`);
  });

  test.each(["0.0.0", "1.2.3", "1.2.0-rc.1", "9999.9999.9999", `1.0.0-${"a".repeat(20)}`])(
    "check-version passes %s",
    (version) => {
      expect(versionProblems(version)).toEqual([]);
    },
  );

  test.each([
    "1.1.0-rc-1",
    "10000.0.0",
    "1.0.0+build.1",
    `1.0.0-${"a".repeat(21)}`,
    "1.2",
    "v1.2.3",
    "",
    undefined,
  ])("check-version refuses %j, which the server cannot read", (version) => {
    expect(versionProblems(version)).not.toEqual([]);
  });

  test("package.json's version is one the server reads", () => {
    const { version } = JSON.parse(read("package.json")) as { version: string };
    expect(versionProblems(version)).toEqual([]);
  });
});

describe("release scripts", () => {
  test("check-tag passes a tag that names the package and source version", () => {
    expect(tagProblems("v1.2.3", "1.2.3", "1.2.3")).toEqual([]);
    expect(tagProblems("v1.2.0-rc.1", "1.2.0-rc.1", "1.2.0-rc.1")).toEqual([]);
  });

  // The tag, package.json and src/version.ts agree, but the server would never record an install.
  test.each(["v1.1.0-rc-1", "v10000.0.0"])(
    "check-tag refuses %s, a version the server cannot read",
    (tag) => {
      const version = tag.slice(1);
      expect(tagProblems(tag, version, version)).toEqual([
        expect.stringContaining("not a release tag: v + a version our server reads"),
      ]);
    },
  );

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

describe("release.yml", () => {
  const workflow = read(".github/workflows/release.yml");

  /** Where `text` first appears in release.yml. */
  function at(text: string): number {
    const index = workflow.indexOf(text);
    expect(index, `release.yml has ${text}`).toBeGreaterThanOrEqual(0);
    return index;
  }

  // RELEASING.md forbids rerunning a job after it staged: a missing CHANGELOG
  // section must fail the job before that.
  test("writes the release notes right after the tag check, before the tests and the stage", () => {
    const notes = at("node scripts/changelog-section.mjs");
    expect(at("node scripts/check-tag.mjs")).toBeLessThan(notes);
    expect(notes).toBeLessThan(at("- run: npm test"));
    expect(notes).toBeLessThan(at("- name: Stage on npm"));
  });

  test("the draft release reads the notes written before the stage", () => {
    const file = /node scripts\/changelog-section\.mjs "[^"]+" > "([^"]+)"/.exec(workflow)?.[1];
    expect(file).toBeDefined();
    expect(at(`--notes-file "${file}"`)).toBeGreaterThan(at("- name: Draft GitHub release"));
    expect(workflow.split("changelog-section.mjs")).toHaveLength(2);
  });
});
