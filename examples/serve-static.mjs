// Serves the built site (dist/ of the working directory) like a static host
// would: files as they are, a folder as its index.html. The static Astro apps
// start it from their own folder. Used instead of `astro preview`, which may
// start in the background and outlive the example run.
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve("dist") + sep;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" };

createServer(async (request, response) => {
  const path = normalize(
    decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname),
  );
  const file = join(root, path.endsWith("/") ? `${path}index.html` : path);
  const candidates = extname(file) === "" ? [`${file}/index.html`, `${file}.html`] : [file];
  for (const candidate of candidates) {
    if (!candidate.startsWith(root)) break;
    try {
      const body = await readFile(candidate);
      response.writeHead(200, {
        "content-type": TYPES[extname(candidate)] ?? "application/octet-stream",
      });
      response.end(body);
      return;
    } catch {
      // Try the next candidate.
    }
  }
  response.writeHead(404, { "content-type": "text/plain" }).end("Not found\n");
}).listen(Number(process.env.PORT ?? 4321), process.env.HOST ?? "127.0.0.1");
