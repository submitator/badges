// Checks the HTML a site serves the way directories and our badge checks read
// it. First the self-check of CONTRACT.md section 10, counted like
// `grep -cE 'data-sbm-ref="?<project>'` (lines that match), then, with parse5,
// the wall itself: one root, one style element, no script, the self badge
// with its marker, directory links outside span.sbm-cb, custom ones inside,
// and links in the aria-hidden loop copy and fill items out of the tab order.
//
//   node examples/check-html.mjs --url https://your-site.com --project <id>
//   node examples/check-html.mjs --file page.html --project <id> [--negative]
//
// --negative checks a client-only render instead: the self-check must find 0.
// run-example.mjs uses the exported functions.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parse } from "parse5";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Lines of `html` that match `pattern`, as `grep -c` counts them. */
function grepCount(html, pattern) {
  return html.split("\n").filter((line) => pattern.test(line)).length;
}

/** The self-check of CONTRACT.md section 10: 1 or more means the self badge is in the HTML. */
export function selfCheckCount(html, project) {
  if (!UUID.test(project)) throw new Error(`not a project id: ${project}`);
  return grepCount(html, new RegExp(`data-sbm-ref="?${project}`));
}

/** The old check (`grep -c 'ref=<id>'`), which also matches hydration data. */
export function refCount(html, project) {
  return grepCount(html, new RegExp(`ref=${project}`));
}

const isElement = (node) => typeof node.tagName === "string";

function attr(element, name) {
  return element.attrs.find((entry) => entry.name === name)?.value;
}

function hasClass(element, name) {
  return (attr(element, "class") ?? "").split(/\s+/).includes(name);
}

/** Every element under `node`, depth first, template contents included. */
function elementsUnder(node) {
  const children = [...(node.childNodes ?? []), ...(node.content?.childNodes ?? [])];
  return children.filter(isElement).flatMap((element) => [element, ...elementsUnder(element)]);
}

function ancestors(element) {
  const list = [];
  for (let node = element.parentNode; node; node = node.parentNode) {
    if (isElement(node)) list.push(node);
  }
  return list;
}

function hostOf(href) {
  try {
    return new URL(href.trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Inspects a page. `expected` (optional) lists the wall's directory and custom
 * hosts. Returns { problems, notes }: no problems means the page passes.
 *
 * @param {string} html
 * @param {{ project: string, expected?: { directoryHosts: string[], customHosts: string[] }, negative?: boolean }} options
 * @returns {{ problems: string[], notes: string[] }}
 */
export function inspectPage(html, { project, expected, negative = false }) {
  const problems = [];
  const notes = [];
  const selfLines = selfCheckCount(html, project);
  const document = parse(html);
  const roots = elementsUnder(document).filter(
    (element) => element.tagName === "div" && hasClass(element, "sbm-wall"),
  );
  notes.push(`self-check: ${selfLines}`, `old ref= check: ${refCount(html, project)}`);

  if (negative) {
    if (selfLines !== 0) {
      problems.push(`a client-only render must not pass the self-check, found ${selfLines}`);
    }
    if (roots.length !== 0)
      problems.push(`expected no wall in the server HTML, found ${roots.length}`);
    return { problems, notes };
  }

  if (selfLines < 1) problems.push("the self-check finds 0: the badges are not in the server HTML");
  if (roots.length !== 1) {
    problems.push(`expected one wall root (div.sbm-wall), found ${roots.length}`);
    return { problems, notes };
  }

  const root = roots[0];
  const inside = elementsUnder(root);
  const version = attr(root, "data-sbm-wall");
  if (version === undefined) problems.push("the wall root has no data-sbm-wall");
  else notes.push(`data-sbm-wall: ${version}`);

  const styles = inside.filter((element) => element.tagName === "style");
  if (styles.length !== 1) problems.push(`expected one style element, found ${styles.length}`);
  const css = styles[0]?.childNodes.map((node) => node.value ?? "").join("") ?? "";
  if (!css.includes(".sbm-wall{")) problems.push("the style element does not hold the wall's CSS");
  if (inside.some((element) => element.tagName === "script")) {
    problems.push("a script element sits inside the wall");
  }

  const isHidden = (element) =>
    ancestors(element).some((parent) => attr(parent, "aria-hidden") === "true");
  const inCustom = (element) =>
    ancestors(element).some((parent) => parent.tagName === "span" && hasClass(parent, "sbm-cb"));
  const links = inside.filter((element) => element.tagName === "a");

  const self = links.filter(
    (link) =>
      attr(link, "data-sbm-ref") === project &&
      (attr(link, "href") ?? "").includes(`ref=${project}`) &&
      !isHidden(link),
  );
  if (self.length === 0) {
    problems.push("no visible self badge link with data-sbm-ref and ?ref= for the project");
  }

  for (const link of links.filter(isHidden)) {
    if (attr(link, "tabindex") !== "-1") {
      problems.push(
        `a link in the loop copy or a fill item lacks tabindex=-1: ${attr(link, "href")}`,
      );
      break;
    }
  }
  if (hasClass(root, "sbm-wall-marquee")) {
    const copies = inside.filter(
      (element) => element.tagName === "ul" && hasClass(element, "sbm-wall-copy"),
    );
    if (copies.length !== 1 || attr(copies[0], "aria-hidden") !== "true") {
      problems.push("a marquee needs one aria-hidden loop copy (ul.sbm-wall-copy)");
    }
  }
  for (const fill of inside.filter((element) => hasClass(element, "sbm-wall-fill"))) {
    if (attr(fill, "aria-hidden") !== "true") {
      problems.push("a fill item is not aria-hidden");
      break;
    }
  }

  if (expected !== undefined) {
    for (const host of expected.directoryHosts) {
      const found = links.some(
        (link) => hostOf(attr(link, "href") ?? "") === host && !inCustom(link) && !isHidden(link),
      );
      if (!found) problems.push(`no visible link to the directory ${host} outside span.sbm-cb`);
    }
    for (const host of expected.customHosts) {
      const matching = links.filter((link) => hostOf(attr(link, "href") ?? "") === host);
      if (matching.length === 0) problems.push(`no link to the custom badge host ${host}`);
      if (matching.some((link) => !inCustom(link))) {
        problems.push(`a link to the custom badge host ${host} sits outside span.sbm-cb`);
      }
    }
  }
  return { problems, notes };
}

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const project = option("project");
  const url = option("url");
  const file = option("file");
  if (project === undefined || (url === undefined) === (file === undefined)) {
    console.error(
      "usage: check-html.mjs (--url <url> | --file <path>) --project <id> [--negative]",
    );
    process.exit(2);
  }
  const html =
    url !== undefined
      ? await fetch(url, { redirect: "follow" }).then((response) => response.text())
      : readFileSync(file, "utf8");
  const { problems, notes } = inspectPage(html, {
    project,
    negative: process.argv.includes("--negative"),
  });
  for (const note of notes) console.log(`  ${note}`);
  for (const problem of problems) console.error(`  FAIL ${problem}`);
  console.log(problems.length === 0 ? "ok" : `${problems.length} problem(s)`);
  process.exit(problems.length === 0 ? 0 : 1);
}
