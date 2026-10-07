// Generate only the homepage AVIF variants; preserve the original and WebP fallback.
const path = require("node:path");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const frontendRequire = createRequire(path.join(root, "frontend/package.json"));
const nextRequire = createRequire(frontendRequire.resolve("next"));
const sharp = nextRequire("sharp");

async function main() {
  const media = path.join(root, "frontend/public/media");
  for (const width of [750, 1080, 1437]) {
    const result = await sharp(path.join(media, "bumblebee-children-party.png"))
      .resize({ width, withoutEnlargement: true })
      .avif({ quality: 55, effort: 6 })
      .toFile(path.join(media, `bumblebee-children-party-${width}.avif`));
    console.log(`${width}px: ${result.size} bytes`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
