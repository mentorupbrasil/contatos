import sharp from "sharp";
import path from "path";

const src = path.join(process.cwd(), "public/brand/luzia-logo-dark.png");
const out = path.join(process.cwd(), "public/brand/luzia-logo-clear.png");

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += info.channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r < 28 && g < 28 && b < 28) {
    data[i + 3] = 0;
  }
}

await sharp(data, {
  raw: { width: info.width, height: info.height, channels: info.channels },
})
  .trim()
  .png()
  .toFile(out);

const meta = await sharp(out).metadata();
console.log("wrote", out, meta.width, meta.height);
