#!/usr/bin/env node
// Renders the shipped raster brand assets from the SVG sources in brand/.
// sharp is deliberately not a workspace dependency; run through npx:
//   npx -y -p sharp@0.34.5 -c "node brand/scripts/render.mjs"
// Outputs: apps/web/public/brand/og.png, apps/web/src/app/apple-icon.png,
// apps/web/src/app/favicon.ico, plus review previews in $PREVIEW_DIR (default /tmp/ghost-brand).
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PREVIEW = process.env.PREVIEW_DIR ?? "/tmp/ghost-brand";
const COLOR = { forest: "#052018", petal: "#FCB8CD", porcelain: "#F8F1EF", ink: "#17241E" };

// npx puts its temporary node_modules/.bin on PATH; resolve sharp from there.
function loadSharp() {
  const bins = (process.env.PATH ?? "").split(delimiter).filter((p) => p.endsWith(join("node_modules", ".bin")));
  for (const bin of bins) {
    try {
      return createRequire(join(bin, "..", "noop.js"))("sharp");
    } catch {
      continue;
    }
  }
  throw new Error('sharp not found. Run: npx -y -p sharp@0.34.5 -c "node brand/scripts/render.mjs"');
}
const sharp = loadSharp();

const src = (name) => readFileSync(join(ROOT, "brand", name), "utf8");
const tint = (svg, color) => svg.replaceAll("currentColor", color);
const png = (svg, width, height) =>
  sharp(Buffer.from(svg), { density: 600 }).resize(width, height ?? width, { fit: "contain", background: "#0000" }).png().toBuffer();

// ICO container holding PNG-encoded images (supported by every current browser).
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

async function panel(svg, width, height, bg, contentWidth) {
  const art = await png(svg, contentWidth, Math.round(height * 0.8));
  return sharp({ create: { width, height, channels: 4, background: bg } })
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toBuffer();
}

async function main() {
  mkdirSync(PREVIEW, { recursive: true });
  const forestIcon = src("app-icon-forest.svg");
  const lockup = src("lockup-horizontal.svg");

  writeFileSync(join(ROOT, "apps/web/public/brand/og.png"), await panel(tint(lockup, COLOR.petal), 1200, 630, COLOR.forest, 640));
  writeFileSync(join(ROOT, "apps/web/src/app/apple-icon.png"), await png(forestIcon, 180));
  const sizes = [16, 32, 48];
  const favicons = await Promise.all(sizes.map(async (size) => ({ size, data: await png(forestIcon, size) })));
  writeFileSync(join(ROOT, "apps/web/src/app/favicon.ico"), ico(favicons));

  // Review previews (not shipped).
  const x16 = favicons[0].data;
  writeFileSync(join(PREVIEW, "favicon-16-x4.png"), await sharp(x16).resize(64, 64, { kernel: "nearest" }).png().toBuffer());
  writeFileSync(join(PREVIEW, "lockup-on-forest.png"), await panel(tint(lockup, COLOR.petal), 1200, 400, COLOR.forest, 900));
  writeFileSync(join(PREVIEW, "lockup-on-porcelain.png"), await panel(tint(lockup, COLOR.forest), 1200, 400, COLOR.porcelain, 900));
  const icons = await Promise.all(
    ["forest", "petal", "navy"].flatMap((v) => [png(src(`app-icon-${v}.svg`), 1024), png(src(`app-icon-${v}.svg`), 32)]),
  );
  icons.forEach((buf, i) => writeFileSync(join(PREVIEW, `app-icon-${["forest", "petal", "navy"][i >> 1]}-${i % 2 ? 32 : 1024}.png`), buf));
  process.stdout.write(`rendered og.png, apple-icon.png, favicon.ico; previews in ${PREVIEW}\n`);
}

await main();
