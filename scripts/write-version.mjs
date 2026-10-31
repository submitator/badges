// Writes src/version.ts from package.json. With --check it only compares them and
// fails when they differ (the build runs it that way; `npm version` writes it).
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const { version } = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const target = new URL("src/version.ts", root);
const expected =
  "// Written by scripts/write-version.mjs from package.json: do not edit by hand.\n" +
  `export const VERSION: string = ${JSON.stringify(version)};\n`;

let current = "";
try {
  current = readFileSync(target, "utf8");
} catch {
  current = "";
}

if (process.argv.includes("--check")) {
  if (current !== expected) {
    console.error(
      `src/version.ts does not match package.json ${version}: run node scripts/write-version.mjs`,
    );
    process.exit(1);
  }
} else if (current !== expected) {
  writeFileSync(target, expected);
  console.log(`src/version.ts: ${version}`);
}
