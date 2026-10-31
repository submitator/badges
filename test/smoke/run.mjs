// Starts the mock wall server, then runs the smoke checks in one runtime
// against the built package (run `npm run build` first, or point --package at
// an unpacked tarball's package/ folder).
//
//   node test/smoke/run.mjs                      # Node.js (this one)
//   node test/smoke/run.mjs --runtime node --exec ~/.nvm/versions/node/v20.19.4/bin/node
//   node test/smoke/run.mjs --runtime bun
//   node test/smoke/run.mjs --runtime deno
//   node test/smoke/run.mjs --runtime workerd    # needs npm ci --prefix test/smoke/workerd
//
// The runtime name is also the User-Agent token the checks expect.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startMockServer } from "../../examples/mock-wall-server/server.mjs";
import { smokeContext } from "./context.mjs";

const here = fileURLToPath(new URL("./", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
};
const runtime = option("runtime", "node");
const packageDir = resolve(option("package", resolve(here, "../..")));
if (!existsSync(resolve(packageDir, "dist/index.js"))) {
  console.error(`no ${packageDir}/dist/index.js: run npm run build first`);
  process.exit(2);
}

/** Runs smoke.mjs in a Node.js, Bun or Deno binary. */
function runScript(apiUrl) {
  const smoke = resolve(here, "smoke.mjs");
  const tail = ["--api", apiUrl, "--runtime", runtime, "--package", packageDir];
  const command = {
    node: [option("exec", process.execPath), [smoke, ...tail]],
    bun: [option("exec", "bun"), [smoke, ...tail]],
    deno: [option("exec", "deno"), ["run", "--allow-all", smoke, ...tail]],
  }[runtime];
  if (command === undefined) throw new Error(`unknown runtime ${runtime}`);
  return new Promise((done, fail) => {
    const child = spawn(command[0], command[1], { stdio: "inherit" });
    child.on("error", fail);
    child.on("exit", (code) => done(code ?? 1));
  });
}

/** Runs checks.mjs inside workerd through Miniflare, with the package's dist/ as modules. */
async function runWorkerd(apiUrl) {
  const require = createRequire(resolve(here, "workerd/package.json"));
  const { Miniflare } = await import(pathToFileURL(require.resolve("miniflare")).href);
  const dist = readdirSync(resolve(packageDir, "dist")).filter(
    // The core only: the React and Vue adapters import their frameworks.
    (name) => name.endsWith(".js") && name !== "react.js" && name !== "vue.js",
  );
  const worker = [
    'import * as pkg from "./dist/index.js";',
    'import { runChecks } from "./__smoke_checks.mjs";',
    "export default {",
    "  async fetch(request, env) {",
    "    return Response.json(await runChecks(pkg, JSON.parse(env.SMOKE)));",
    "  },",
    "};",
  ].join("\n");
  const mf = new Miniflare({
    modulesRoot: packageDir,
    modules: [
      { type: "ESModule", path: resolve(packageDir, "__smoke_worker.mjs"), contents: worker },
      {
        type: "ESModule",
        path: resolve(packageDir, "__smoke_checks.mjs"),
        contents: readFileSync(resolve(here, "checks.mjs"), "utf8"),
      },
      ...dist.map((name) => ({ type: "ESModule", path: resolve(packageDir, "dist", name) })),
    ],
    compatibilityDate: "2026-07-01",
    bindings: { SMOKE: JSON.stringify(smokeContext({ apiUrl, runtime: "workerd" })) },
  });
  try {
    const response = await mf.dispatchFetch("http://smoke.invalid/");
    const results = await response.json();
    for (const { name, ok, detail } of results) {
      console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
    }
    const failed = results.filter((result) => !result.ok).length;
    console.log(failed === 0 ? "smoke (workerd): ok" : `smoke (workerd): ${failed} failed`);
    return failed === 0 ? 0 : 1;
  } finally {
    await mf.dispose();
  }
}

const mock = await startMockServer({ port: 0 });
let code = 1;
try {
  code = runtime === "workerd" ? await runWorkerd(mock.url) : await runScript(mock.url);
} finally {
  await mock.close();
}
process.exit(code);
