// Builds and serves one example app against the mock wall server, then checks
// what it serves with check-html.mjs. Every app depends on
// file:../.pack/submitator-badges.tgz: the packed tarball of this repo, never
// the copy on npm. CI runs one app per job.
//
//   node examples/run-example.mjs <app> [--tarball <path>] [--save-page] [--latest]
//
// --tarball    a tarball from `npm pack` (default: pack the repo now)
// --save-page  write the served homepage to test/fixtures/contract-v1/pages/<app>.html
//              (and pages/manifest.json, the same for every app)
// --latest     install the app's frameworks at @latest (the weekly CI job)
// --no-install, --no-build  reuse what an earlier run left (local reruns only)
//
// Needs the repo's dev dependencies (parse5) and Node.js 24.15 or later.
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APPS } from "./apps.mjs";
import { inspectPage, selfCheckCount } from "./check-html.mjs";
import { PROJECTS, expectedWall } from "./mock-wall-server/projects.mjs";
import { startMockServer } from "./mock-wall-server/server.mjs";

const examples = fileURLToPath(new URL("./", import.meta.url));
const root = resolve(examples, "..");
const pagesDir = resolve(root, "test/fixtures/contract-v1/pages");
const packDir = resolve(examples, ".pack");
/** The path every example's package.json points at. */
const INSTALLED_TARBALL = resolve(packDir, "submitator-badges.tgz");
const APP_PORT = 4100;
const MOCK_PORT = 4010;
const USER_AGENT =
  /^submitator-badges\/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?) \(([a-z][a-z0-9-]{0,31})((?:; [^;()]+)*); \+https:\/\/submitator\.com\/badge-package\)$/;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const app = args.find(
  (arg, index) => !arg.startsWith("--") && !args[index - 1]?.startsWith("--tarball"),
);
const config = APPS[app];
if (config === undefined) {
  console.error(`usage: run-example.mjs <app> [options]; apps: ${Object.keys(APPS).join(", ")}`);
  process.exit(2);
}
const appDir = resolve(examples, app);

/** The environment of every child: production builds, no telemetry, no NODE_ENV from the shell. */
function childEnv(extra = {}) {
  const env = {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: "1",
    NUXT_TELEMETRY_DISABLED: "1",
    ASTRO_TELEMETRY_DISABLED: "1",
    ...extra,
  };
  delete env.NODE_ENV;
  return env;
}

/** Runs a command to completion; stdout is returned when `capture` is set. */
function run(command, commandArgs, { cwd, capture = false } = {}) {
  return new Promise((done, fail) => {
    const child = spawn(command, commandArgs, {
      cwd,
      env: childEnv(),
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    });
    let out = "";
    child.stdout?.on("data", (chunk) => (out += chunk));
    child.on("error", fail);
    child.on("exit", (code) =>
      code === 0
        ? done(out)
        : fail(new Error(`${command} ${commandArgs.join(" ")} exited ${code}`)),
    );
  });
}

/** Starts the app's server in its own process group, so stopping it stops its workers too. */
function serve() {
  const child = spawn("npm", ["start"], {
    cwd: appDir,
    env: childEnv({ PORT: String(APP_PORT), HOST: "127.0.0.1" }),
    stdio: "inherit",
    detached: true,
  });
  return () => {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  };
}

async function get(path) {
  const response = await fetch(`http://127.0.0.1:${APP_PORT}${path}`, { redirect: "manual" });
  return { status: response.status, headers: response.headers, html: await response.text() };
}

async function waitForApp(seconds) {
  for (let elapsed = 0; elapsed < seconds * 2; elapsed += 1) {
    try {
      await get("/");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`the app did not answer on port ${APP_PORT} within ${seconds} s`);
}

async function pack() {
  mkdirSync(packDir, { recursive: true });
  const out = await run("npm", ["pack", "--json", "--pack-destination", packDir], {
    cwd: root,
    capture: true,
  });
  const [entry] = JSON.parse(out.slice(out.indexOf("[")));
  return resolve(packDir, entry.filename);
}

/**
 * Writes the served homepage, and the manifest the backend's checks read. The
 * manifest is the same for every app and every run, so CI jobs can merge them.
 */
function savePage(html) {
  mkdirSync(pagesDir, { recursive: true });
  writeFileSync(resolve(pagesDir, `${app}.html`), html);
  const wall = expectedWall();
  const pages = Object.keys(APPS)
    .sort()
    .map((name) => [
      name,
      {
        file: `${name}.html`,
        framework: APPS[name].framework,
        // found: BadgeChecker finds the self badge. missing: a client-only render.
        badge: APPS[name].negative === true ? "missing" : "found",
      },
    ]);
  const manifest = {
    project: wall.project,
    directoryHosts: wall.directoryHosts,
    customHosts: wall.customHosts,
    pages: Object.fromEntries(pages),
  };
  writeFileSync(resolve(pagesDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

const problems = [];
const notes = [];
const check = (ok, problem) => {
  if (!ok) problems.push(problem);
};

async function checkApp(mock, packageVersion) {
  const home = await get("/");
  check(home.status === 200, `GET / answered ${home.status}`);
  const page = inspectPage(home.html, {
    project: PROJECTS.good,
    expected: expectedWall(),
    negative: config.negative === true,
  });
  problems.push(...page.problems);
  notes.push(...page.notes);
  if (config.negative !== true) {
    check(
      home.html.includes(`data-sbm-wall="${packageVersion}"`),
      `the wall root does not carry data-sbm-wall="${packageVersion}"`,
    );
  }

  for (const path of config.pages ?? []) {
    const extra = await get(path);
    check(extra.status === 200, `GET ${path} answered ${extra.status}`);
    check(selfCheckCount(extra.html, PROJECTS.good) >= 1, `the self-check finds 0 on ${path}`);
  }
  for (const [path, expected] of Object.entries(config.lifetime ?? {})) {
    const cacheControl = (await get(path)).headers.get("cache-control") ?? "";
    notes.push(`Cache-Control of ${path}: ${cacheControl}`);
    check(cacheControl.includes(expected), `Cache-Control of ${path} lacks ${expected}`);
  }
  if (config.broken !== undefined) {
    const broken = await get(config.broken);
    check(broken.status === 200, `GET ${config.broken} answered ${broken.status}`);
    check(
      selfCheckCount(broken.html, PROJECTS.badSignature) === 0,
      `a wall with a bad signature was rendered on ${config.broken}`,
    );
  }

  const walls = mock.requests.filter((request) =>
    [PROJECTS.good, PROJECTS.badSignature].includes(request.project),
  );
  check(walls.length > 0, "the app never requested its wall");
  const agents = new Set();
  for (const request of walls) {
    agents.add(request.userAgent);
    const match = USER_AGENT.exec(request.userAgent ?? "");
    check(match !== null, `User-Agent outside the contract: ${request.userAgent}`);
    if (match === null) continue;
    check(match[1] === packageVersion, `User-Agent names version ${match[1]}`);
    check(match[2] === config.framework, `User-Agent names ${match[2]}, not ${config.framework}`);
    check(!match[3].includes("; dev"), "a production build sent the dev token");
    check(request.accept === "application/json", `Accept: ${request.accept}`);
    check(request.origin === null, "a wall request carried an Origin header");
    check(request.cookie === null, "a wall request carried a cookie");
  }
  notes.push(`wall requests: ${walls.length}, User-Agent: ${[...agents].join(" | ")}`);
  return home.html;
}

async function checkBump(mock) {
  const response = await fetch(`${mock.url}/__bump?project=${PROJECTS.good}`, { method: "POST" });
  const { host } = await response.json();
  const started = Date.now();
  while (Date.now() - started < config.bump * 1000) {
    const { html } = await get("/");
    if (html.includes(`https://${host}/`)) {
      notes.push(
        `a badge added on the server showed up after ${Math.round((Date.now() - started) / 1000)} s`,
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  problems.push(`a badge added on the server did not show up within ${config.bump} s`);
}

const tarball = option("tarball") ? resolve(option("tarball")) : await pack();
const packageVersion = JSON.parse(
  execFileSync("tar", ["-xOzf", tarball, "package/package.json"], { encoding: "utf8" }),
).version;
const mock = await startMockServer({ port: MOCK_PORT });
let stop = () => {};
process.on("SIGINT", () => {
  stop();
  process.exit(130);
});

try {
  if (!flag("no-install")) {
    mkdirSync(packDir, { recursive: true });
    if (tarball !== INSTALLED_TARBALL) copyFileSync(tarball, INSTALLED_TARBALL);
    // The version stays the same between builds of the repo: drop the old copy so npm unpacks the new one.
    rmSync(resolve(appDir, "node_modules/@submitator/badges"), { recursive: true, force: true });
    const quiet = ["--no-package-lock", "--no-audit", "--no-fund"];
    await run("npm", ["install", ...quiet], { cwd: appDir });
    if (flag("latest") && config.latest.length > 0) {
      const latest = config.latest.map((name) => `${name}@latest`);
      await run("npm", ["install", "--no-save", ...quiet, ...latest], { cwd: appDir });
    }
  }
  if (!flag("no-build")) {
    // A fresh build every time: Next.js would answer from its fetch cache of the last build.
    for (const output of [".next", ".nuxt", ".output", ".svelte-kit", "build", "dist", ".astro"]) {
      rmSync(resolve(appDir, output), { recursive: true, force: true });
    }
    await run("npm", ["run", "build"], { cwd: appDir });
  }
  stop = serve();
  await waitForApp(60);
  const html = await checkApp(mock, packageVersion);
  if (config.bump !== undefined && problems.length === 0) await checkBump(mock);
  if (flag("save-page")) savePage(html);
} catch (error) {
  problems.push(String(error?.message ?? error));
} finally {
  stop();
  await mock.close();
}

console.log(`\n${app}:`);
for (const note of notes) console.log(`  ${note}`);
for (const problem of problems) console.error(`  FAIL ${problem}`);
console.log(problems.length === 0 ? `${app}: ok` : `${app}: ${problems.length} problem(s)`);
process.exit(problems.length === 0 ? 0 : 1);
