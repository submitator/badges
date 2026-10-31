// What the smoke checks need besides the package: the shared fixtures and the
// mock server's projects. Plain JSON, so it also travels into workerd.
import { readFileSync, readdirSync } from "node:fs";
import { PROJECTS, PUBLIC_KEYS, goodBadges } from "../../examples/mock-wall-server/projects.mjs";

const fixtures = new URL("../fixtures/contract-v1/", import.meta.url);
const read = (path) => readFileSync(new URL(path, fixtures), "utf8");
const list = (dir, extension) =>
  readdirSync(new URL(dir, fixtures))
    .filter((name) => name.endsWith(extension))
    .sort();

/** The context of runChecks for a mock wall server at `apiUrl`, in `runtime`. */
export function smokeContext({ apiUrl, runtime }) {
  return {
    apiUrl,
    runtime,
    projects: PROJECTS,
    publicKeys: PUBLIC_KEYS,
    goodIds: goodBadges(PROJECTS.good).map((badge) => badge.id),
    vector: JSON.parse(read("vector.json")),
    walls: list("walls/", ".json").map((name) => JSON.parse(read(`walls/${name}`))),
    rendered: Object.fromEntries(
      list("rendered/", ".html").map((name) => [name, read(`rendered/${name}`)]),
    ),
  };
}
