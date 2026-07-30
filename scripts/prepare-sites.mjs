import { mkdir, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outputDirectory = join(process.cwd(), "dist");
const serverDirectory = join(outputDirectory, "server");
const metadataDirectory = join(outputDirectory, ".openai");
const assetsDirectory = join(outputDirectory, "assets");

await mkdir(serverDirectory, { recursive: true });
await mkdir(metadataDirectory, { recursive: true });
await mkdir(assetsDirectory, { recursive: true });

for (const entry of await readdir(outputDirectory)) {
  if (entry === "assets" || entry === "server" || entry === ".openai") continue;
  await rename(join(outputDirectory, entry), join(assetsDirectory, entry));
}

await writeFile(
  join(serverDirectory, "index.js"),
  `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      url.pathname = "/index.html";
      return env.ASSETS.fetch(new Request(url, request));
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || url.pathname.includes(".")) return response;

    url.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(url, request));
  }
};
`,
  "utf8"
);

await writeFile(
  join(metadataDirectory, "hosting.json"),
  JSON.stringify(
    {
      project_id: "appgprj_6a6bba2d6660819196271b906b720cc9"
    },
    null,
    2
  ),
  "utf8"
);
