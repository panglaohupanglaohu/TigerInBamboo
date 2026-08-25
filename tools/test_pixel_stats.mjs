// tools/test_pixel_stats.mjs — pixelStats.mjs 纯函数单测
// 运行：node tools/test_pixel_stats.mjs
import assert from "node:assert/strict";
import {
  srgbChannelToLinear,
  rgbToLab,
  hexToRgb,
  deltaE00,
  deltaLStar,
  deltaE00Colors,
  luminance255,
  analyzePixels,
  buildPageStatsScript,
} from "./lib/pixelStats.mjs";

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

ok("srgbChannelToLinear 端点与分段", () => {
  assert.equal(srgbChannelToLinear(0), 0);
  assert.ok(Math.abs(srgbChannelToLinear(1) - 1) < 1e-9);
  assert.ok(Math.abs(srgbChannelToLinear(0.04045) - 0.04045 / 12.92) < 1e-9);
  assert.ok(Math.abs(srgbChannelToLinear(0.5) - 0.21404114) < 1e-6);
});

ok("rgbToLab 已知值：白/黑/红", () => {
  const white = rgbToLab(255, 255, 255);
  assert.ok(Math.abs(white.L - 100) < 0.05, `white L=${white.L}`);
  const black = rgbToLab(0, 0, 0);
  assert.ok(Math.abs(black.L) < 0.01, `black L=${black.L}`);
  // sRGB 纯红 → Lab 标准参考值
  const red = rgbToLab(255, 0, 0);
  assert.ok(Math.abs(red.L - 53.2408) < 0.05, `red L=${red.L}`);
  assert.ok(Math.abs(red.a - 80.0925) < 0.1, `red a=${red.a}`);
  assert.ok(Math.abs(red.b - 67.2032) < 0.1, `red b=${red.b}`);
});

ok("hexToRgb 三种输入", () => {
  assert.deepEqual(hexToRgb("#FF8000"), { r: 255, g: 128, b: 0 });
  assert.deepEqual(hexToRgb("ff8000"), { r: 255, g: 128, b: 0 });
  assert.deepEqual(hexToRgb(0xff8000), { r: 255, g: 128, b: 0 });
});

ok("deltaE00 Sharma 标准测试向量", () => {
  // 经典参考对：ΔE00 = 2.0425
  const d = deltaE00({ L: 50, a: 2.6772, b: -79.7751 }, { L: 50, a: 0, b: -82.7485 });
  assert.ok(Math.abs(d - 2.0425) < 0.001, `ΔE00=${d}`);
});

ok("deltaE00 同一颜色为 0，黑白大差异", () => {
  const red = rgbToLab(255, 0, 0);
  assert.ok(deltaE00(red, red) < 1e-9);
  assert.ok(deltaE00Colors("#FFFFFF", "#000000") > 90);
});

ok("deltaLStar 白黑差约 100", () => {
  assert.ok(Math.abs(deltaLStar("#FFFFFF", "#000000") - 100) < 0.1);
});

ok("luminance255 白=255 黑=0", () => {
  assert.ok(Math.abs(luminance255(255, 255, 255) - 255) < 1e-9);
  assert.equal(luminance255(0, 0, 0), 0);
});

ok("analyzePixels 合成图像：半黑半白 + 背景剔除", () => {
  // 10×10：左上角背景色 (10, 20, 30)，主体一半黑一半白
  const W = 10;
  const H = 10;
  const px = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (x === 0) {
        px[i] = 10;
        px[i + 1] = 20;
        px[i + 2] = 30;
      } else if (y < 5) {
        px[i] = 0;
        px[i + 1] = 0;
        px[i + 2] = 0;
      } else {
        px[i] = 255;
        px[i + 1] = 255;
        px[i + 2] = 255;
      }
      px[i + 3] = 255;
    }
  }
  const s = analyzePixels(px, { bgTolerance: 20 });
  assert.equal(s.totalPixels, 100);
  assert.equal(s.subjectPixels, 90);
  assert.equal(s.p10, 0);
  assert.equal(s.p90, 255);
  // 45 白 / 90 主体 = 50% 截断
  assert.equal(s.clippedPercent, 50);
  // 主色两桶：白、黑各 50%
  assert.equal(s.dominantColors.length, 2);
  assert.ok(Math.abs(s.dominantColors[0].share - 0.5) < 0.01);
  assert.ok(Math.abs(s.top3Share - 1) < 0.01);
});

ok("analyzePixels 全背景返回 null，空输入返回 null", () => {
  const px = new Uint8Array(4 * 4 * 4);
  px.fill(128);
  for (let i = 3; i < px.length; i += 4) px[i] = 255;
  assert.equal(analyzePixels(px), null);
  assert.equal(analyzePixels(new Uint8Array(0)), null);
});

ok("analyzePixels 透明度为 0 的像素剔除", () => {
  const px = new Uint8Array([255, 255, 255, 0, 200, 100, 50, 255]);
  // 第一个像素 alpha=0 剔除但仍是 bg 参考；第二个像素与 bg 距离够大 → 主体 1
  const s = analyzePixels(px, { bgTolerance: 5 });
  assert.equal(s.subjectPixels, 1);
});

ok("buildPageStatsScript 生成自包含脚本", () => {
  const script = buildPageStatsScript({ maxSize: 256, topColors: 5 });
  assert.ok(script.includes("function analyzePixels"));
  assert.ok(script.includes("function rgbToLab"));
  assert.ok(script.includes("function deltaE00"));
  assert.ok(script.includes("getImageData"));
  assert.ok(script.includes('"topColors":5'));
  // 语法可解析
  new Function(`return (${script})`);
});

console.log(`\n全部通过：${passed} 项`);
