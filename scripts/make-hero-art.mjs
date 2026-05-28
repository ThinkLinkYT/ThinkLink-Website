import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const width = 1600;
const height = 900;
const out = fileURLToPath(new URL("../assets/img/thinklink-hero.png", import.meta.url));
const pixels = Buffer.alloc((width * 4 + 1) * height);

const colors = {
  skyTop: [7, 10, 8],
  skyBottom: [18, 36, 24],
  deep: [10, 13, 10],
  grass: [79, 160, 73],
  grassLight: [121, 241, 95],
  dirt: [104, 80, 52],
  stone: [74, 82, 78],
  cyan: [79, 210, 216],
  amber: [255, 209, 102],
  red: [255, 107, 107]
};

for (let y = 0; y < height; y += 1) {
  const row = y * (width * 4 + 1);
  pixels[row] = 0;
  for (let x = 0; x < width; x += 1) {
    const offset = row + 1 + x * 4;
    const t = y / height;
    const base = mix(colors.skyTop, colors.skyBottom, Math.min(1, t * 1.2));
    const grid = hash(Math.floor(x / 44), Math.floor(y / 44));
    const tint = grid > 0.74 ? mix(base, colors.cyan, 0.1) : grid < 0.08 ? mix(base, colors.amber, 0.08) : base;
    set(offset, tint);
  }
}

drawHills();
drawFloatingBlocks();
drawBeacon();
drawForegroundBlocks();
writePng(width, height, pixels, out);

function drawHills() {
  for (let x = 0; x < width; x += 32) {
    const ridge = 520 + Math.sin(x / 130) * 34 + Math.sin(x / 47) * 15;
    for (let y = Math.floor(ridge); y < height; y += 1) {
      const depth = (y - ridge) / (height - ridge);
      const color = depth < 0.08
        ? mix(colors.grass, colors.grassLight, 0.28)
        : depth < 0.32
          ? colors.dirt
          : mix(colors.stone, colors.deep, Math.min(0.72, depth));
      drawRect(x, y, 34, 1, shade(color, hash(x, y) * 0.18 - 0.05));
    }
  }

  for (let x = 0; x < width; x += 48) {
    const h = 30 + Math.floor(hash(x, 17) * 120);
    const y = 560 - h;
    drawBlock(x, y, 48, 38, colors.grass, colors.dirt);
  }
}

function drawFloatingBlocks() {
  const blocks = [
    [174, 210, 62, colors.grassLight, colors.dirt],
    [270, 310, 42, colors.stone, colors.deep],
    [1180, 190, 54, colors.amber, colors.dirt],
    [1306, 300, 44, colors.cyan, colors.stone],
    [1020, 250, 38, colors.grass, colors.dirt]
  ];

  for (const [x, y, size, top, side] of blocks) {
    drawBlock(x, y, size, Math.floor(size * 0.72), top, side);
  }
}

function drawBeacon() {
  drawRect(774, 120, 12, 610, [79, 210, 216]);
  drawRect(790, 130, 8, 600, [121, 241, 95]);
  drawRect(760, 684, 76, 34, colors.cyan);
  drawRect(738, 718, 122, 46, colors.stone);
  drawRect(706, 764, 186, 48, colors.deep);
  drawRect(674, 812, 250, 58, colors.grass);
}

function drawForegroundBlocks() {
  for (let x = -30; x < width; x += 58) {
    const h = 70 + Math.floor(hash(x, 99) * 110);
    const y = height - h;
    const accent = hash(x, 7);
    const top = accent > 0.88 ? colors.red : accent > 0.72 ? colors.amber : colors.grass;
    drawBlock(x, y, 58, h, top, accent > 0.72 ? colors.stone : colors.dirt);
  }
}

function drawBlock(x, y, w, h, top, side) {
  drawRect(x, y, w, Math.max(10, Math.floor(h * 0.28)), top);
  drawRect(x, y + Math.floor(h * 0.28), w, h, side);
  drawRect(x + Math.floor(w * 0.66), y + Math.floor(h * 0.28), Math.ceil(w * 0.34), h, shade(side, -0.18));
  drawRect(x + 4, y + 4, Math.max(0, w - 8), 4, shade(top, 0.16));
}

function drawRect(x, y, w, h, color) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.ceil(x + w));
  const y1 = Math.min(height, Math.ceil(y + h));

  for (let py = y0; py < y1; py += 1) {
    const row = py * (width * 4 + 1);
    for (let px = x0; px < x1; px += 1) {
      set(row + 1 + px * 4, color);
    }
  }
}

function set(offset, [r, g, b]) {
  pixels[offset] = clamp(r);
  pixels[offset + 1] = clamp(g);
  pixels[offset + 2] = clamp(b);
  pixels[offset + 3] = 255;
}

function shade(color, amount) {
  return color.map((value) => value + value * amount);
}

function mix(a, b, t) {
  return a.map((value, index) => value + (b[index] - value) * t);
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function writePng(w, h, raw, fileUrl) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);

  mkdirSync(dirname(fileUrl), { recursive: true });
  writeFileSync(fileUrl, png);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let i = 0; i < 8; i += 1) {
      value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}
