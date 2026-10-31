import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { FIXTURES, buildFixtures } from "../../scripts/write-fixtures.mjs";

describe("hand-written fixtures", () => {
  const built = buildFixtures();

  test("the committed files equal what scripts/write-fixtures.mjs builds", () => {
    for (const file of built) {
      expect(readFileSync(new URL(file.path, FIXTURES), "utf8"), file.path).toBe(file.text);
    }
  });

  test("no stale hand-written wall or envelope is left behind", () => {
    const expected = new Set(built.map((file) => file.path));
    const onDisk = [
      ...readdirSync(new URL("walls/", FIXTURES))
        .filter((name) => name.startsWith("hand-"))
        .map((name) => `walls/${name}`),
      ...readdirSync(new URL("envelopes/", FIXTURES)).map((name) => `envelopes/${name}`),
    ];
    expect(onDisk.filter((path) => !expected.has(path))).toEqual([]);
  });
});
