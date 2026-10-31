// The runtime smoke test for Node.js, Bun and Deno: loads the built package
// (dist/index.js under --package, default the repo) and runs checks.mjs
// against a mock wall server at --api. run.mjs starts the server and this
// script in the runtime under test:
//
//   node test/smoke/run.mjs --runtime node|bun|deno|workerd [--exec <binary>] [--package <dir>]
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runChecks } from "./checks.mjs";
import { smokeContext } from "./context.mjs";

const args = globalThis.Deno?.args ?? process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
};

const apiUrl = option("api");
const runtime = option("runtime");
const packageDir = resolve(option("package", new URL("../../", import.meta.url).pathname));
if (apiUrl === undefined || runtime === undefined) {
  console.error("usage: smoke.mjs --api <mock url> --runtime <token> [--package <dir>]");
  process.exit(2);
}

const pkg = await import(pathToFileURL(resolve(packageDir, "dist/index.js")).href);
const results = await runChecks(pkg, smokeContext({ apiUrl, runtime }));
for (const { name, ok, detail } of results) {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}
const failed = results.filter((result) => !result.ok).length;
console.log(failed === 0 ? `smoke (${runtime}): ok` : `smoke (${runtime}): ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
