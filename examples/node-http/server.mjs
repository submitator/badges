// "Any other Node server" from the README, with the local backend options:
// the mock wall server and its test key instead of the production defaults.
import { createServer } from "node:http";
import { fetchWall, wallToHtml } from "@submitator/badges";

const API_URL = "http://127.0.0.1:4010";
const PUBLIC_KEYS = { "test-rfc8032-1": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" };
const PROJECT = "00000000-0000-4000-8000-000000000001";
// A project whose wall has a bad signature: the page must still answer 200.
const BROKEN_PROJECT = "00000000-0000-4000-8000-000000000002";

function page(title, badgesHtml) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title></head>
<body>
<main><h1>${title}</h1></main>
<footer>${badgesHtml}</footer>
</body>
</html>
`;
}

createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  if (path !== "/" && path !== "/broken") {
    response.writeHead(404, { "content-type": "text/plain" }).end("Not found\n");
    return;
  }
  const project = path === "/" ? PROJECT : BROKEN_PROJECT;
  const wall = await fetchWall({ project, apiUrl: API_URL, publicKeys: PUBLIC_KEYS });
  const badgesHtml = wallToHtml(wall); // "" when there is no wall; every value is escaped
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(page(path === "/" ? "Node.js example" : "Broken wall", badgesHtml));
}).listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? "127.0.0.1");
