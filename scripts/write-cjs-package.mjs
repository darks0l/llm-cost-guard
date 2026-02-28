import { mkdir, writeFile } from "node:fs/promises";

async function main() {
  await mkdir("dist/cjs", { recursive: true });
  await writeFile("dist/cjs/package.json", '{"type":"commonjs"}\n', "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});