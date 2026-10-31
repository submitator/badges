// The hand-written cases of contract v1: realistic badges, one bad badge per
// badge-level rule, one wall per wall-level reason and the envelope cases.
// scripts/write-fixtures.mjs turns them into test/fixtures/contract-v1/, and
// the unit tests use the same tables, so the files and the tests never drift.
// Every id and URL here is synthetic; no customer data.

export const PROJECT = "8b0c2f4e-6a51-4c1e-9f3d-2a7b5c9e1d40";
export const ISSUED_AT = "2026-11-01T00:00:00Z";
export const EXPIRES_AT = "2026-11-08T00:00:00Z";
export const NOW = "2026-11-02T00:00:00Z";

// RFC 8032 section 7.1 TEST 1 (CONTRACT.md section 3): tests and local development only.
export const TEST_KEY = {
  keyId: "test-rfc8032-1",
  seed: "nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A",
  publicKey: "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
};

/** A synthetic directory badge id. */
export const directoryId = (n) => `d_00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** A synthetic custom badge id. */
export const customId = (n) => `c_00000000-0000-4000-9000-${String(n).padStart(12, "0")}`;

const SVG = "http://www.w3.org/2000/svg";

/** Our retail self badge (the pill), as the server's tree builder writes it. */
export function selfPill(project = PROJECT) {
  return {
    kind: "self",
    id: "self",
    tree: [
      {
        t: "a",
        a: {
          href: `https://submitator.com?ref=${project}`,
          "data-sbm-ref": project,
          target: "_blank",
          rel: "noopener noreferrer",
          title: "Featured on Submitator",
        },
        s: [
          ["text-decoration", "none"],
          ["display", "inline-block"],
        ],
        c: [
          {
            t: "span",
            s: [
              ["display", "inline-flex"],
              ["align-items", "center"],
              ["gap", "8px"],
              ["padding", "8px 12px"],
              ["background", "#0a0a0a"],
              ["color", "#ffffff"],
              ["border", "2px solid #CCFF00"],
              ["border-radius", "4px"],
              ["box-shadow", "3px 3px 0 #CCFF00"],
              ["font-family", "ui-sans-serif,system-ui,-apple-system,sans-serif"],
            ],
            c: [
              {
                t: "svg",
                a: {
                  xmlns: SVG,
                  width: "18",
                  height: "18",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "#CCFF00",
                  "stroke-width": "2.5",
                  "stroke-linecap": "round",
                  "stroke-linejoin": "round",
                },
                c: [
                  { t: "circle", a: { cx: "12", cy: "12", r: "10" } },
                  { t: "path", a: { d: "m9 12 2 2 4-4" } },
                ],
              },
              {
                t: "span",
                s: [
                  ["display", "flex"],
                  ["flex-direction", "column"],
                  ["line-height", "1"],
                  ["gap", "3px"],
                ],
                c: [
                  {
                    t: "span",
                    s: [
                      ["font-size", "10px"],
                      ["font-weight", "600"],
                      ["letter-spacing", "1px"],
                      ["text-transform", "uppercase"],
                      ["color", "#CCFF00"],
                    ],
                    c: ["Featured on"],
                  },
                  {
                    t: "span",
                    s: [
                      ["font-size", "15px"],
                      ["font-weight", "800"],
                      ["letter-spacing", "0.3px"],
                    ],
                    c: ["SUBMITATOR"],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/** A small self badge, like the one in vector.json. */
export function selfLink(project = PROJECT) {
  return {
    kind: "self",
    id: "self",
    tree: [
      {
        t: "a",
        a: {
          href: `https://submitator.com?ref=${project}`,
          "data-sbm-ref": project,
          target: "_blank",
          rel: "noopener noreferrer",
          title: "Featured on Submitator",
        },
        c: ["Featured on SUBMITATOR"],
      },
    ],
  };
}

/** `<a href><img></a>`, with the spaces the server keeps around the img. */
function linkedImage(n, name, host, link, image, { spaced = true, linkStyle, imageStyle } = {}) {
  const img = { t: "img", a: image };
  if (imageStyle) img.s = imageStyle;
  const a = { t: "a", a: link };
  if (linkStyle) a.s = linkStyle;
  a.c = spaced ? [" ", img, " "] : [img];
  return { kind: "directory", id: directoryId(n), name, host, tree: [a] };
}

/** Directory badges shaped like real templates (rendered for a project named AI Tool). */
export const DIRECTORY_BADGES = [
  linkedImage(
    1,
    "Turbo0",
    "turbo0.com",
    { href: "https://turbo0.com/item/ai-tool", target: "_blank", rel: "noopener noreferrer" },
    { src: "https://img.turbo0.com/badge-listed-light.svg", alt: "Listed on Turbo0" },
    {
      imageStyle: [
        ["height", "54px"],
        ["width", "auto"],
      ],
    },
  ),
  linkedImage(
    2,
    "Easy Do Follow",
    "easydofollow.dev",
    { href: "http://easydofollow.dev/productivity/ai-tool", target: "_blank", rel: "noopener" },
    {
      src: "http://easydofollow.dev/badge/easydofollow-badge-light.svg",
      alt: "Featured on EasyDoFollow",
      width: "188",
      height: "56",
    },
  ),
  linkedImage(
    3,
    "Yo.directory",
    "yo.directory",
    { href: "https://yo.directory", target: "_blank", rel: "dofollow noopener" },
    {
      src: "https://assets.yo.directory/badges/yo-directory-featured-dark.svg",
      alt: "Featured on Yo.directory",
      width: "260",
      height: "94",
    },
    {
      spaced: false,
      linkStyle: [
        ["display", "inline-block"],
        ["text-decoration", "none"],
      ],
      imageStyle: [
        ["display", "block"],
        ["width", "260px"],
        ["max-width", "100%"],
        ["height", "auto"],
        ["border", "0"],
        ["outline", "none"],
        ["text-decoration", "none"],
      ],
    },
  ),
  {
    kind: "directory",
    id: directoryId(4),
    name: "Amaze Directory",
    host: "amaze.directory",
    tree: [
      {
        t: "a",
        a: {
          href: "https://amaze.directory/tools/aitool-example",
          target: "_blank",
          rel: "noopener",
          title: "AI Tool on amaze.directory",
        },
        s: [
          ["display", "inline-flex"],
          ["align-items", "center"],
          ["gap", "10px"],
          ["padding", "10px 16px"],
          ["border-radius", "14px"],
          ["background", "#17161a"],
          ["border", "1px solid rgba(243,242,242,0.14)"],
          ["text-decoration", "none"],
          ["font-family", "Archivo,system-ui,-apple-system,Segoe UI,sans-serif"],
          ["line-height", "1.15"],
        ],
        c: [
          {
            t: "span",
            s: [
              ["display", "inline-flex"],
              ["align-items", "center"],
              ["justify-content", "center"],
              ["width", "26px"],
              ["height", "26px"],
              ["border-radius", "999px"],
              ["background", "linear-gradient(120deg,#ff563c,#ffd24a)"],
              ["color", "#17161a"],
              ["font-weight", "800"],
              ["font-size", "14px"],
              ["flex", "none"],
            ],
            c: ["a"],
          },
          {
            t: "span",
            s: [
              ["display", "inline-flex"],
              ["flex-direction", "column"],
            ],
            c: [
              {
                t: "span",
                s: [
                  ["font-size", "9.5px"],
                  ["font-weight", "700"],
                  ["letter-spacing", "0.14em"],
                  ["text-transform", "uppercase"],
                  ["color", "rgba(243,242,242,0.62)"],
                ],
                c: ["Listed on"],
              },
              {
                t: "span",
                s: [
                  ["font-size", "14px"],
                  ["font-weight", "800"],
                  ["letter-spacing", "-0.01em"],
                  ["color", "#ffffff"],
                ],
                c: ["amaze.directory"],
              },
            ],
          },
        ],
      },
    ],
  },
  linkedImage(
    5,
    "LiftOff",
    "lift-off.sh",
    { href: "https://lift-off.sh/p/ai-tool", target: "_blank", title: "'LiftOff' - Default v2" },
    {
      src: "https://lift-off.sh/images/badges/badgeLaunchedLightBAR.webp",
      alt: "'LiftOff' Default v2 badge",
      width: "200",
      height: "auto",
    },
  ),
  {
    kind: "directory",
    id: directoryId(6),
    name: "Badge Directory",
    host: "badge-dir.example.com",
    tree: [
      { t: "a", a: { href: "https://badge-dir.example.com/p/AI Tool" }, c: ["Badge Directory"] },
    ],
  },
  linkedImage(
    7,
    "CurlShip",
    "curlship.com",
    { href: "https://curlship.com" },
    {
      src: "https://curlship.com/badge.svg",
      alt: "Listed on CurlShip",
      width: "120",
      height: "20",
    },
  ),
  linkedImage(
    8,
    "Startup Benchmarks",
    "startupbenchmarks.com",
    { target: "_blank", href: "https://startupbenchmarks.com/product/aitool-example" },
    {
      src: "https://startupbenchmarks.com/assets/images/badge.png",
      alt: "Startup Benchmarks",
      height: "54",
      loading: "lazy",
    },
    { spaced: false },
  ),
  linkedImage(
    9,
    "Spot Startups",
    "spotstartups.com",
    { href: "https://spotstartups.com", target: "_blank" },
    {
      src: "https://spotstartups.com/badges/spotstartups.com_badge_light.svg",
      width: "175",
      height: "55",
    },
  ),
  linkedImage(
    10,
    "Nick Launches",
    "nicklaunches.com",
    {
      href: "https://nicklaunches.com/products/ai-tool/?utm_medium=badge&utm_campaign=featured",
      target: "_blank",
      rel: "noopener",
    },
    {
      src: "https://nicklaunches.com/badges/featured.png",
      alt: "AI Tool on Nick Launches",
      width: "171",
      height: "39",
    },
    { spaced: false },
  ),
];

/** Custom badges as customers paste them (the server drops class, never adds the wrapper). */
export const CUSTOM_BADGES = [
  {
    kind: "custom",
    id: customId(1),
    name: "Product Hunt",
    tree: [
      {
        t: "a",
        a: {
          href: "https://www.producthunt.com/posts/ai-tool?utm_source=badge-featured&utm_medium=badge",
          target: "_blank",
          rel: "noopener noreferrer",
        },
        c: [
          {
            t: "img",
            a: {
              src: "https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1&theme=light",
              alt: "AI Tool - The best tool | Product Hunt",
              width: "250",
              height: "54",
            },
            s: [
              ["width", "250px"],
              ["height", "54px"],
            ],
          },
        ],
      },
    ],
  },
  {
    kind: "custom",
    id: customId(2),
    name: "freeboard.lol",
    tree: [
      {
        t: "a",
        a: {
          href: "https://freeboard.lol",
          target: "_blank",
          rel: "noopener",
          title: "Featured on freeboard.lol",
        },
        s: [
          ["text-decoration", "none"],
          ["display", "inline-block"],
        ],
        c: [
          {
            t: "span",
            s: [
              ["display", "inline-flex"],
              ["align-items", "center"],
              ["gap", "8px"],
              ["padding", "8px 12px"],
              ["background", "#0a0a0a"],
              ["color", "#ffffff"],
              ["border", "2px solid #CCFF00"],
              ["border-radius", "4px"],
              ["box-shadow", "3px 3px 0 #CCFF00"],
              ["font-family", "ui-sans-serif,system-ui,-apple-system,sans-serif"],
            ],
            c: [
              {
                t: "span",
                s: [
                  ["display", "flex"],
                  ["flex-direction", "column"],
                  ["line-height", "1"],
                  ["gap", "3px"],
                ],
                c: [
                  {
                    t: "span",
                    s: [
                      ["font-size", "10px"],
                      ["font-weight", "600"],
                      ["letter-spacing", "1px"],
                      ["text-transform", "uppercase"],
                      ["color", "#CCFF00"],
                    ],
                    c: ["Featured on"],
                  },
                  {
                    t: "span",
                    s: [
                      ["font-size", "15px"],
                      ["font-weight", "800"],
                      ["letter-spacing", "0.3px"],
                      ["text-transform", "uppercase"],
                    ],
                    c: ["freeboard.lol"],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    kind: "custom",
    id: customId(3),
    name: "Мой бейдж G2 ✓",
    tree: [
      {
        t: "a",
        a: { href: "https://www.g2.com/products/ai-tool/reviews?utm_source=rewards-badge" },
        c: [
          {
            t: "img",
            a: {
              alt: "AI Tool is a leader in Productivity on G2",
              src: "https://images.g2crowd.com/uploads/report_medal/image/1/medal.svg",
            },
            s: [["width", "125px"]],
          },
        ],
      },
    ],
  },
];

/** Accepted but unusual: every edge the contract allows. */
export const EDGE_BADGES = [
  {
    kind: "directory",
    id: directoryId(20),
    name: "Upper Case Scheme",
    host: "example.com",
    tree: [
      {
        t: "a",
        a: { href: "HTTPS://Example.com/Upper Case" },
        c: [{ t: "img", a: { src: "HTTP://example.com/badge.svg", alt: "" } }],
      },
    ],
  },
  {
    kind: "directory",
    id: directoryId(21),
    name: "Two Links",
    host: "two-links.example.org",
    tree: [
      {
        t: "a",
        a: { href: "https://two-links.example.org/p/ai-tool", rel: "nofollow" },
        c: [{ t: "img", a: { src: "https://two-links.example.org/badge.png", loading: "eager" } }],
      },
      " ",
      { t: "a", a: { href: "https://two-links.example.org/about" }, c: ["About"] },
    ],
  },
  {
    kind: "directory",
    id: directoryId(22),
    name: "Launch Hub",
    host: "launchhub.example.net",
    tree: [
      {
        t: "a",
        a: {
          href: "https://launchhub.example.net/p/ai-tool",
          target: "_blank",
          "aria-label": "AI Tool on Launch Hub",
        },
        s: [
          ["display", "inline-flex"],
          ["align-items", "center"],
          ["gap", "6px"],
        ],
        c: [
          {
            t: "svg",
            a: {
              xmlns: SVG,
              viewBox: "0 0 32 32",
              width: "20",
              height: "20",
              "aria-hidden": "true",
            },
            c: [
              { t: "circle", a: { cx: "16", cy: "16", r: "15", fill: "#111111" } },
              {
                t: "path",
                a: {
                  d: "M16 6 L22 20 L16 17 L10 20 Z M14 22 h4 v4 h-4 Z",
                  fill: "#FFD24A",
                  stroke: "#111111",
                  "stroke-width": "1",
                },
              },
            ],
          },
          { t: "span", c: ["Launch Hub"] },
        ],
      },
    ],
  },
  {
    // Lenient fields: a malformed id, host and name are dropped, the badge stays.
    kind: "directory",
    id: "d_not-a-uuid",
    name: "",
    host: "bad host/path",
    tree: [
      {
        t: "a",
        a: { href: "https://lenient.example.com" },
        c: [{ t: "img", a: { src: "https://lenient.example.com/badge.svg" } }],
      },
    ],
  },
  {
    kind: "custom",
    id: customId(20),
    name: 'Tom & Jerry\'s "badge" <3',
    tree: [
      {
        t: "span",
        a: { title: 'Tom & Jerry\'s "badge" <3', "aria-label": "A styled badge" },
        s: [
          ["font-family", '"Segoe UI",sans-serif'],
          ["width", "calc(100% - var(--sbm-gap, 4px))"],
          ["--badge-accent", "#CCFF00"],
          ["color", "var(--badge-accent)"],
          ["color", "red"],
          ["-webkit-text-size-adjust", "100%"],
          ["quotes", "'(' ')'"],
          ["background", "linear-gradient(90deg, rgba(0,0,0,0.5), transparent)"],
        ],
        c: ["Tom & Jerry <3 \"quoted\" 'single'"],
      },
    ],
  },
  {
    kind: "custom",
    id: customId(21),
    name: "Logo without alt",
    tree: [{ t: "img", a: { src: "https://cdn.example.com/logo.png", width: "88", height: "31" } }],
  },
];

const goodLink = (href = "https://bad.example.com") => ({ t: "a", a: { href }, c: ["Badge"] });
const nested = (depth) => {
  let node = "deep";
  for (let i = 0; i < depth - 1; i += 1) node = { t: "span", c: [node] };
  return node;
};
const styled = (s) => [{ t: "span", s, c: ["styled"] }];

/** One bad badge per badge-level rule, with the reason parseWall gives. */
export const SKIP_CASES = [
  ["an unknown tag", "tag", [{ t: "div", c: ["x"] }]],
  ["a script element", "tag", [{ t: "script", c: ["alert(1)"] }]],
  ["a node without a tag", "tag", [{ c: ["x"] }]],
  [
    "a class attribute",
    "attribute",
    [{ t: "a", a: { href: "https://x.example", class: "fixed inset-0" }, c: ["x"] }],
  ],
  [
    "a style attribute instead of s",
    "attribute",
    [{ t: "span", a: { style: "color:red" }, c: ["x"] }],
  ],
  [
    "an event handler",
    "attribute",
    [{ t: "a", a: { href: "https://x.example", onclick: "steal()" }, c: ["x"] }],
  ],
  ["an id attribute", "attribute", [{ t: "span", a: { id: "header" }, c: ["x"] }]],
  ["a javascript: href", "url", [goodLink("javascript:alert(1)")]],
  ["a data: src", "url", [{ t: "img", a: { src: "data:image/svg+xml,<svg/>" } }]],
  ["a relative href", "url", [goodLink("/p/ai-tool")]],
  ["a protocol-relative href", "url", [goodLink("//evil.example/p")]],
  ["a space before the scheme", "url", [goodLink(" https://x.example")]],
  ["a space after the scheme", "url", [goodLink("https:// x.example")]],
  ["a scheme with nothing after it", "url", [goodLink("https://")]],
  ["a tab inside an href", "url", [goodLink("https://x.example/a\tb")]],
  ["href on a span", "attribute", [{ t: "span", a: { href: "https://x.example" }, c: ["x"] }]],
  ["src on a span", "attribute", [{ t: "span", a: { src: "https://x.example/b.png" }, c: ["x"] }]],
  ["xmlns on a span", "attribute", [{ t: "span", a: { xmlns: SVG }, c: ["x"] }]],
  [
    "xmlns with another namespace",
    "attribute",
    [{ t: "svg", a: { xmlns: "http://www.w3.org/1999/xhtml" } }],
  ],
  [
    "an a inside an a",
    "structure",
    [{ t: "a", a: { href: "https://x.example" }, c: [{ t: "span", c: [goodLink()] }] }],
  ],
  ["an a inside an svg", "structure", [{ t: "svg", c: [goodLink()] }]],
  ["text inside an svg", "structure", [{ t: "svg", c: ["text"] }]],
  ["an svg inside an svg", "structure", [{ t: "svg", c: [{ t: "svg" }] }]],
  ["a path outside an svg", "structure", [{ t: "path", a: { d: "M0 0" } }]],
  ["a circle inside a span", "structure", [{ t: "span", c: [{ t: "circle", a: { r: "1" } }] }]],
  [
    "an img with children",
    "structure",
    [{ t: "img", a: { src: "https://x.example/b.png" }, c: ["x"] }],
  ],
  ["a semicolon in a style value", "style", styled([["color", "red;position:fixed"]])],
  ["a brace in a style value", "style", styled([["color", "red}body{color:red"]])],
  ["an angle bracket in a style value", "style", styled([["color", "red</style>"]])],
  ["a backslash in a style value", "style", styled([["position", "fi\\78 ed"]])],
  ["!important in a style value", "style", styled([["color", "red !important"]])],
  ["url( in a style value", "style", styled([["background", "url(https://x.example/a.png)"]])],
  ["expression( in a style value", "style", styled([["width", "expression(alert(1))"]])],
  ["@import in a style value", "style", styled([["font-family", "@import 'x'"]])],
  ["image-set( in a style value", "style", styled([["background", "image-set('a.png' 1x)"]])],
  ["a comment in a style value", "style", styled([["position", "/**/fixed"]])],
  ["the behavior property", "style", styled([["behavior", "x"]])],
  ["the -moz-binding property", "style", styled([["-moz-binding", "none"]])],
  ["position fixed", "style", styled([["position", "fixed"]])],
  ["position FIXED in capitals", "style", styled([["position", "FIXED"]])],
  ["an unbalanced quote", "style", styled([["font-family", '"Segoe UI,sans-serif']])],
  ["an unbalanced parenthesis", "style", styled([["width", "calc(100% - 4px"]])],
  ["a stray closing parenthesis", "style", styled([["width", ")calc("]])],
  ["an uppercase property", "style", styled([["Color", "red"]])],
  ["an empty style value", "style", styled([["color", "   "]])],
  ["a declaration with three items", "style", styled([["color", "red", "blue"]])],
  ["s that is not an array", "style", [{ t: "span", s: "color:red", c: ["x"] }]],
  ["65 style declarations", "limits", styled(Array.from({ length: 65 }, () => ["color", "red"]))],
  ["a style value over 1024 characters", "limits", styled([["font-family", "a".repeat(1025)]])],
  ["an empty text node", "text", [{ t: "span", c: [""] }]],
  ["a control character in text", "text", [{ t: "span", c: ["a\x01b"] }]],
  ["DEL in text", "text", [{ t: "span", c: ["a\x7fb"] }]],
  [
    "a control character in an attribute",
    "attribute",
    [{ t: "span", a: { title: "a\x0bb" }, c: ["x"] }],
  ],
  [
    "an attribute value that is not a string",
    "attribute",
    [{ t: "img", a: { src: "https://x.example/b.png", width: 250 } }],
  ],
  ["a that is an array", "attribute", [{ t: "span", a: [], c: ["x"] }]],
  ["17 root nodes", "limits", Array.from({ length: 17 }, () => goodLink())],
  ["a tree 17 levels deep", "limits", [nested(17)]],
  [
    "301 nodes",
    "limits",
    [{ t: "span", c: Array.from({ length: 150 }, () => ({ t: "span", c: ["x"] })) }],
  ],
  ["text over 1000 characters", "limits", [{ t: "span", c: ["a".repeat(1001)] }]],
  [
    "an attribute over 2048 characters",
    "limits",
    [{ t: "span", a: { title: "a".repeat(2049) }, c: ["x"] }],
  ],
  [
    "path data over 8192 characters",
    "limits",
    [{ t: "svg", c: [{ t: "path", a: { d: "M".repeat(8193) } }] }],
  ],
  ["an unknown node field", "node", [{ t: "span", children: ["x"] }]],
  ["a number as a node", "node", [42]],
  ["null as a node", "node", [null]],
  ["c that is not an array", "node", [{ t: "span", c: "x" }]],
];

/** Badges that are wrong as a whole (not their tree). */
export const BAD_BADGES = [
  [
    "an unknown badge field",
    "badge",
    { kind: "directory", id: directoryId(90), html: "<a>", tree: [goodLink()] },
  ],
  ["an unknown kind", "kind", { kind: "featured", id: directoryId(91), tree: [goodLink()] }],
  ["a missing kind", "kind", { id: directoryId(92), tree: [goodLink()] }],
  ["an empty tree", "tree", { kind: "directory", id: directoryId(93), tree: [] }],
  ["a tree that is not an array", "tree", { kind: "directory", id: directoryId(94), tree: "<a>" }],
  ["a badge that is a string", "badge", "<a href='https://x.example'>x</a>"],
  ["a badge that is null", "badge", null],
  ["a badge that is an array", "badge", [goodLink()]],
];

/** The bad badges of SKIP_CASES and BAD_BADGES as wall entries, in that order. */
export function skipBadges() {
  const fromTrees = SKIP_CASES.map(([rule, , tree], index) => ({
    kind: "directory",
    id: directoryId(100 + index),
    name: `Skipped: ${rule}`,
    host: "bad.example.com",
    tree,
  }));
  return [...fromTrees, ...BAD_BADGES.map(([, , badge]) => badge)];
}

function wall(badges, overrides = {}) {
  return {
    v: 1,
    project: PROJECT,
    issuedAt: ISSUED_AT,
    expiresAt: EXPIRES_AT,
    badges,
    ...overrides,
  };
}

const tinyBadges = (count) =>
  Array.from({ length: count }, (_, i) => ({
    kind: "directory",
    id: directoryId(1000 + i),
    tree: [{ t: "a", a: { href: `https://dir${i}.example.com` }, c: [`Dir ${i}`] }],
  }));

/**
 * The hand-written walls: { name, now?, project?, payload (object or exact text), expect }.
 * `expect.ids` lists the ids of the badges that render, null where a malformed id was dropped.
 */
export const WALL_CASES = [
  {
    name: "hand-retail",
    payload: wall([selfPill(), ...DIRECTORY_BADGES, ...CUSTOM_BADGES]),
    expect: {
      ok: true,
      ids: ["self", ...DIRECTORY_BADGES.map((b) => b.id), ...CUSTOM_BADGES.map((b) => b.id)],
      skipped: 0,
    },
  },
  {
    name: "hand-two-badges",
    payload: wall([selfPill(), DIRECTORY_BADGES[0]]),
    expect: { ok: true, ids: ["self", directoryId(1)], skipped: 0 },
  },
  {
    name: "hand-three-badges",
    payload: wall([selfLink(), DIRECTORY_BADGES[5], CUSTOM_BADGES[1]]),
    expect: { ok: true, ids: ["self", directoryId(6), customId(2)], skipped: 0 },
  },
  {
    name: "hand-edges",
    payload: wall([selfLink(), ...EDGE_BADGES]),
    expect: {
      ok: true,
      ids: [
        "self",
        directoryId(20),
        directoryId(21),
        directoryId(22),
        null,
        customId(20),
        customId(21),
      ],
      skipped: 0,
    },
  },
  {
    name: "hand-skips",
    payload: wall([
      selfLink(),
      ...skipBadges().slice(0, 30),
      DIRECTORY_BADGES[6],
      ...skipBadges().slice(30),
    ]),
    expect: { ok: true, ids: ["self", directoryId(7)], skipped: skipBadges().length },
  },
  {
    name: "hand-lifetime-8-days",
    payload: wall([selfLink()], { expiresAt: "2026-11-09T00:00:00Z" }),
    expect: { ok: true, ids: ["self"], skipped: 0 },
  },
  {
    name: "hand-reject-payload-not-json",
    payload: '{"v":1,"project":',
    expect: { ok: false, reason: "payload", ids: [], skipped: 0 },
  },
  {
    name: "hand-reject-payload-not-object",
    payload: [wall([selfLink()])],
    expect: { ok: false, reason: "payload", ids: [], skipped: 0 },
  },
  {
    name: "hand-reject-payload-extra-key",
    payload: wall([selfLink()], { note: "hi" }),
    expect: { ok: false, reason: "payload", ids: [], skipped: 0 },
  },
  {
    name: "hand-reject-payload-missing-key",
    payload: { v: 1, project: PROJECT, issuedAt: ISSUED_AT, badges: [selfLink()] },
    expect: { ok: false, reason: "payload", ids: [], skipped: 0 },
  },
  {
    name: "hand-reject-payload-badges-not-array",
    payload: wall({ self: selfLink() }),
    expect: { ok: false, reason: "payload", ids: [], skipped: 0 },
  },
  {
    name: "hand-reject-version",
    payload: wall([selfLink()], { v: 2 }),
    expect: { ok: false, reason: "version", ids: [], skipped: 0 },
  },
  {
    name: "hand-reject-project-mismatch",
    payload: wall([selfLink()], { project: "00000000-0000-4000-8000-000000000000" }),
    expect: { ok: false, reason: "project", ids: [], skipped: 0 },
  },
  {
    name: "hand-reject-project-uppercase",
    payload: wall([selfLink()], { project: PROJECT.toUpperCase() }),
    expect: { ok: false, reason: "project", ids: [], skipped: 0 },
  },
  {
    name: "hand-reject-timestamps-offset",
    payload: wall([selfLink()], { issuedAt: "2026-11-01T00:00:00+00:00" }),
    expect: { ok: false, reason: "timestamps", ids: [], skipped: 0 },
  },
  {
    name: "hand-reject-timestamps-not-a-date",
    payload: wall([selfLink()], {
      expiresAt: "2026-02-30T00:00:00Z",
      issuedAt: "2026-02-25T00:00:00Z",
    }),
    now: "2026-02-26T00:00:00Z",
    expect: { ok: false, reason: "timestamps", ids: [], skipped: 0 },
  },
  {
    name: "hand-reject-timestamps-order",
    payload: wall([selfLink()], { issuedAt: EXPIRES_AT }),
    expect: { ok: false, reason: "timestamps", ids: [], skipped: 0 },
  },
  {
    name: "hand-reject-lifetime",
    payload: wall([selfLink()], { expiresAt: "2026-11-09T00:00:01Z" }),
    expect: { ok: false, reason: "lifetime", ids: [], skipped: 0 },
  },
  {
    name: "hand-reject-expired",
    payload: wall([selfLink()]),
    now: EXPIRES_AT,
    expect: { ok: false, reason: "expired", ids: [], skipped: 0 },
  },
  {
    name: "hand-reject-too-many-badges",
    payload: wall([selfLink(), ...tinyBadges(200)]),
    expect: { ok: false, reason: "limits", ids: [], skipped: 0 },
  },
];

/**
 * Envelope cases: `envelope` builds the body from (payload, signature) of a
 * correctly signed payload; `expect` is what the package's check says.
 */
export const ENVELOPE_CASES = [
  {
    name: "good",
    envelope: (e) => e,
    expect: { ok: true },
  },
  {
    name: "bad-signature",
    envelope: (e) => ({ ...e, signature: flipFirst(e.signature) }),
    expect: { ok: false, reason: "signature" },
  },
  {
    name: "payload-changed",
    envelope: (e) => ({ ...e, payload: e.payload.replace("Featured on", "Featured in") }),
    expect: { ok: false, reason: "signature" },
  },
  {
    name: "unknown-key",
    envelope: (e) => ({ ...e, keyId: "k209912-z" }),
    expect: { ok: false, reason: "key" },
  },
  {
    name: "extra-field",
    envelope: (e) => ({ ...e, note: "hi" }),
    expect: { ok: false, reason: "envelope" },
  },
  {
    name: "missing-field",
    envelope: ({ payload, signature }) => ({ payload, signature }),
    expect: { ok: false, reason: "envelope" },
  },
  {
    name: "payload-not-a-string",
    envelope: (e) => ({ ...e, payload: JSON.parse(e.payload) }),
    expect: { ok: false, reason: "envelope" },
  },
  {
    name: "key-id-malformed",
    envelope: (e) => ({ ...e, keyId: "Test_Key" }),
    expect: { ok: false, reason: "envelope" },
  },
  {
    name: "signature-too-short",
    envelope: (e) => ({ ...e, signature: e.signature.slice(0, 85) }),
    expect: { ok: false, reason: "envelope" },
  },
  {
    name: "signature-padded",
    envelope: (e) => ({ ...e, signature: `${e.signature.slice(0, 84)}==` }),
    expect: { ok: false, reason: "envelope" },
  },
  {
    name: "signature-non-canonical",
    envelope: (e) => ({ ...e, signature: setLastBits(e.signature) }),
    expect: { ok: false, reason: "envelope" },
  },
  {
    name: "not-an-object",
    envelope: (e) => [e],
    expect: { ok: false, reason: "envelope" },
  },
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Changes the first character, so the signature decodes to other bytes. */
function flipFirst(signature) {
  const first = signature[0] === "A" ? "B" : "A";
  return first + signature.slice(1);
}

/** Sets the unused low bits of the last character: same bytes, non-canonical text. */
function setLastBits(signature) {
  const last = ALPHABET.indexOf(signature.at(-1));
  return signature.slice(0, -1) + ALPHABET[last | 0b1111];
}
