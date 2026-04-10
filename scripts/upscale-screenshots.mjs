/**
 * Upscale dev-server screenshots to Apple's required pixel dimensions.
 *
 * Source: C:/.playwright-mcp/store/{ipad-13,iphone-69}/*.png
 * Output: assets/store/screenshots/{ipad-13,iphone-69}/*.png
 *
 * iPad 13" (M4 iPad Pro):  1032x1376 CSS → 2064x2752 px (scale 2x)
 * iPhone 6.9" (17 Pro Max): 440x956 CSS → 1320x2868 px (scale 3x)
 */
import sharp from 'sharp';
import { readdir, mkdir } from 'fs/promises';
import { join } from 'path';

const SRC_BASE = 'C:/.playwright-mcp/store';
const OUT_BASE = 'assets/store/screenshots';

const targets = [
  { dir: 'ipad-13', width: 2064, height: 2752 },
  { dir: 'iphone-69', width: 1320, height: 2868 },
];

for (const t of targets) {
  const srcDir = join(SRC_BASE, t.dir);
  const outDir = join(OUT_BASE, t.dir);
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(srcDir)).filter((f) => f.endsWith('.png'));
  for (const f of files) {
    const inPath = join(srcDir, f);
    const outPath = join(outDir, f);
    await sharp(inPath)
      .resize(t.width, t.height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .png()
      .toFile(outPath);
    console.log(`✓ ${t.dir}/${f} → ${t.width}x${t.height}`);
  }
}
console.log('Done.');
