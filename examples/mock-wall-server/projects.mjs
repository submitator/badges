// The projects the mock wall server knows, one per behaviour, and the badges of
// their walls. The badges come from the shared fixture cases, so every id and
// URL is synthetic. The example apps, check-html.mjs and the runtime smoke
// tests all read this file.
import {
  CUSTOM_BADGES,
  DIRECTORY_BADGES,
  TEST_KEY,
  selfPill,
} from "../../scripts/fixture-cases.mjs";

export { TEST_KEY };

/** Project ids. Any other id gets a 404. */
export const PROJECTS = Object.freeze({
  /** A good wall: the self pill, four directory badges and two custom badges. */
  good: "00000000-0000-4000-8000-000000000001",
  /** A good wall with a signature over other bytes. */
  badSignature: "00000000-0000-4000-8000-000000000002",
  /** 503 with Retry-After: 300, as when the kill switch is on. */
  unavailable: "00000000-0000-4000-8000-000000000003",
  /** A good wall, 3 seconds late. */
  slow: "00000000-0000-4000-8000-000000000004",
  /** A wall that expired a day ago. */
  expired: "00000000-0000-4000-8000-000000000005",
  /** A good wall plus one badge the package must leave out. */
  oneBadBadge: "00000000-0000-4000-8000-000000000006",
  /** The self pill and a link whose href and title hold & and quotes (HOSTILE_URL). */
  hostile: "00000000-0000-4000-8000-000000000007",
});

/** The `publicKeys` option for the mock: the RFC 8032 test key, never a production key. */
export const PUBLIC_KEYS = Object.freeze({ [TEST_KEY.keyId]: TEST_KEY.publicKey });

/** Where the example apps expect the mock (they spell it out, like a customer would). */
export const DEFAULT_PORT = 4010;

/** The badges of a good wall, in the server's order: self, directories, custom. */
export function goodBadges(project) {
  return [
    selfPill(project),
    DIRECTORY_BADGES[0], // a > img with style (Turbo0)
    DIRECTORY_BADGES[1], // http:// links and image (EasyDoFollow)
    DIRECTORY_BADGES[3], // a text badge built from styled spans (Amaze)
    DIRECTORY_BADGES[5], // a raw space in the href
    CUSTOM_BADGES[0], // Product Hunt
    CUSTOM_BADGES[2], // G2, with a name outside ASCII
  ];
}

/** The badge POST /__bump adds to a wall. */
export const BUMP_BADGE = Object.freeze({
  kind: "directory",
  id: "d_00000000-0000-4000-8000-000000000099",
  name: "Bumped Directory",
  host: "bumped.example.com",
  tree: [
    {
      t: "a",
      a: { href: "https://bumped.example.com/p/ai-tool", target: "_blank" },
      c: ["Listed on Bumped Directory"],
    },
  ],
});

/** A badge with an event handler: the package leaves it out and shows the rest. */
export const BAD_BADGE = Object.freeze({
  kind: "directory",
  id: "d_00000000-0000-4000-8000-000000000098",
  name: "Event handler",
  host: "bad.example.com",
  tree: [{ t: "a", a: { href: "https://bad.example.com", onclick: "steal()" }, c: ["Bad"] }],
});

/**
 * A URL the contract allows (it is never normalized) holding & and quotes.
 * Astro 4 and 5 write a plain-string http(s) URL with & in it unescaped: the
 * quote would end the attribute and the rest would become an event handler.
 */
export const HOSTILE_URL = 'https://hostile.example.com/?a=1&b=" onmouseover="alert(1)';

/** The directory badge of the hostile wall: one link with HOSTILE_URL as href and title. */
export const HOSTILE_BADGE = Object.freeze({
  kind: "directory",
  id: "d_00000000-0000-4000-8000-000000000097",
  name: "Hostile",
  host: "hostile.example.com",
  tree: [{ t: "a", a: { href: HOSTILE_URL, title: HOSTILE_URL }, c: ["Hostile"] }],
});

/** Normalized host of a URL as the server writes `host`: lowercase, no `www.`. */
export function hostOf(href) {
  try {
    return new URL(href.trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The hosts of every link in a badge tree. */
export function linkHosts(tree) {
  const hosts = new Set();
  const visit = (node) => {
    if (typeof node === "string") return;
    if (node.t === "a" && typeof node.a?.href === "string") {
      const host = hostOf(node.a.href);
      if (host !== null) hosts.add(host);
    }
    for (const child of node.c ?? []) visit(child);
  };
  tree.forEach(visit);
  return [...hosts];
}

/** What a page showing the good wall must hold, for check-html.mjs and the backend. */
export function expectedWall(project = PROJECTS.good) {
  const badges = goodBadges(project);
  return {
    project,
    directoryHosts: badges.filter((badge) => badge.kind === "directory").map((b) => b.host),
    customHosts: [
      ...new Set(badges.filter((b) => b.kind === "custom").flatMap((b) => linkHosts(b.tree))),
    ],
  };
}
