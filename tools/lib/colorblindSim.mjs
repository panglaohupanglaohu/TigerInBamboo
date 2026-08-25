// 色盲/灰度模拟纯函数库 + 最小 PNG 编解码（8bit 非交错，colortype 0/2/4/6）。
// 供 tools/citadel_colorblind_qa.mjs（分析脚本）与 tools/test_colorblind_qa.mjs（单测）共用。
// 色盲模拟：Machado, Oliveira & Fernandes 2009《A Physiologically-based Model
// for Simulation of Color Vision Deficiency》severity=1.0 三矩阵，作用于线性化 sRGB。
// 简化点：仅全色盲（severity 1.0）、无中间型；线性 RGB 乘 3x3 矩阵后 clamp 回 [0,1] 再 sRGB 编码。
// 灰度：ITU-R BT.709 luma（与 tools/lib/pixelStats.mjs 的 luminance255 一致）。
import zlib from "node:zlib";
import { srgbChannelToLinear, luminance255 } from "./pixelStats.mjs";

// ---------- 最小 PNG 编解码 ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
// 解码为 { width, height, data: RGBA Uint8Array }
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("非 PNG 文件");
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0 || ![0, 2, 4, 6].includes(colorType))
    throw new Error(`不支持的 PNG 格式 bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const rowIn = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const rowOut = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? rowOut[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = x >= bpp && prev ? prev[x - bpp] : 0;
      let v = rowIn[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (f !== 0) throw new Error(`未知 filter ${f}`);
      rowOut[x] = v & 0xff;
    }
  }
  // 统一转 RGBA
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * bpp;
    if (colorType === 0) rgba.set([px[s], px[s], px[s], 255], i * 4);
    else if (colorType === 4) rgba.set([px[s], px[s], px[s], px[s + 1]], i * 4);
    else if (colorType === 2) rgba.set([px[s], px[s + 1], px[s + 2], 255], i * 4);
    else rgba.set([px[s], px[s + 1], px[s + 2], px[s + 3]], i * 4);
  }
  return { width, height, data: rgba };
}
// 编码 RGBA → PNG（8bit RGB，filter 0）
export function encodePng(width, height, rgba) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter 0
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      raw[y * (stride + 1) + 1 + x * 3] = rgba[s];
      raw[y * (stride + 1) + 1 + x * 3 + 1] = rgba[s + 1];
      raw[y * (stride + 1) + 1 + x * 3 + 2] = rgba[s + 2];
    }
  }
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "ascii");
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- 色盲模拟（Machado 2009, severity=1.0，作用于线性 sRGB） ----------
export const CVD_MATRICES = Object.freeze({
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
});
const linToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export function simulateCvd(r, g, b, type) {
  const m = CVD_MATRICES[type];
  const rl = srgbChannelToLinear(r / 255), gl = srgbChannelToLinear(g / 255), bl = srgbChannelToLinear(b / 255);
  const f = (i) => Math.max(0, Math.min(1, m[i] * rl + m[i + 1] * gl + m[i + 2] * bl));
  return {
    r: Math.round(linToSrgb(f(0)) * 255),
    g: Math.round(linToSrgb(f(3)) * 255),
    b: Math.round(linToSrgb(f(6)) * 255),
  };
}
export function toGray(r, g, b) {
  const y = Math.round(luminance255(r, g, b)); // ITU-R BT.709
  return { r: y, g: y, b: y };
}
// 逐像素映射整图
export function mapImage(img, fn) {
  const out = new Uint8Array(img.data.length);
  for (let i = 0; i < img.data.length; i += 4) {
    const c = fn(img.data[i], img.data[i + 1], img.data[i + 2]);
    out[i] = c.r; out[i + 1] = c.g; out[i + 2] = c.b; out[i + 3] = 255;
  }
  return { width: img.width, height: img.height, data: out };
}
