import sharp from "sharp";
import { readFileSync } from "node:fs";
const svg = readFileSync("scripts/icon.svg");
const out = "public";
const jobs = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-icon.png", 180],
];
for (const [name, size] of jobs) {
  await sharp(svg).resize(size, size).png().toFile(`${out}/${name}`);
  console.log("gerado", name, `${size}x${size}`);
}
