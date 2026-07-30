import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outputDirectory = join(process.cwd(), "dist");
const serverDirectory = join(outputDirectory, "server");
const metadataDirectory = join(outputDirectory, ".openai");

await mkdir(serverDirectory, { recursive: true });
await mkdir(metadataDirectory, { recursive: true });

await writeFile(
  join(serverDirectory, "index.js"),
  `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
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
