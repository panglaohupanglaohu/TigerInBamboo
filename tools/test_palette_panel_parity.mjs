// =====================================================================
// 搭建面板色块 == 实际渲染墙色（2026-09-05）
// 用法：node tools/test_palette_panel_parity.mjs
//
// 这条守的是一个漂过两次的病：面板一份硬编码十六进制、生产一份色板，
// 改了色板忘了改面板，于是「选了 X 建出来是 Y」。
//   第一次：注释里写着「修复选『薄荷』建成色差问题」
//   第二次：2026-09-05 主人截屏——选松石绿 #32CBB2 建出风化白石 #D5D9D2，
//           实测 15 个字符 14 个对不上，C 的 RGB 距离 167
//
// 判据是**结构**而不是数值：面板不得自带色表，必须从色板派生。
// 这样以后改色板（马卡龙 → 别的）都不会把这条打红，
// 但一旦有人再抄一份硬编码就会立刻红。
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const SRC = new URL("src/", BASE);

const {
  TOWNSCAPER_HIGHLAND_PALETTE,
  TOWNSCAPER_HIGHLAND_GATE_COLOR,
  TOWNSCAPER_CANAL_PALETTE,
} = await import(new URL("world/citadelTown.js", SRC).href);

let pass = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const hex6 = (n) => `#${(n & 0xffffff).toString(16).padStart(6, "0").toUpperCase()}`;
const rgb = (s) => {
  const v = parseInt(String(s).replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const dist = (a, b) => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.round(Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2));
};

const panelSrc = fs.readFileSync(
  fileURLToPath(new URL("ui/citadelEditorPanel.js", SRC)),
  "utf8"
);

console.log("[1] 面板必须从色板派生，不得自带高山色表");
assert.match(
  panelSrc,
  /PANEL_CHARS\s*=\s*Object\.freeze\(\{[\s\S]{0,400}TOWNSCAPER_HIGHLAND_PALETTE/,
  "PANEL_CHARS 必须由 TOWNSCAPER_HIGHLAND_PALETTE 派生"
);
assert.match(
  panelSrc,
  /CHAR_NAMES\s*=\s*Object\.freeze\(\{[\s\S]{0,400}TOWNSCAPER_HIGHLAND_PALETTE/,
  "CHAR_NAMES 必须由 TOWNSCAPER_HIGHLAND_PALETTE 派生"
);
assert.match(
  panelSrc,
  /import\s*\{[\s\S]*?TOWNSCAPER_HIGHLAND_PALETTE[\s\S]*?\}\s*from\s*"\.\.\/world\/citadelTown\.js/,
  "面板必须 import TOWNSCAPER_HIGHLAND_PALETTE"
);
ok("PANEL_CHARS / CHAR_NAMES 均从色板派生");

console.log("[2] 高山色表不得再出现硬编码十六进制串");
// 只看 PANEL_CHARS 那一段：运河那套 PANEL_CHARS_CANAL 仍是手写的（它与
// TOWNSCAPER_CANAL_PALETTE 目前一致，见第 4 项），这里不牵连它。
const highlandBlock = panelSrc.slice(
  panelSrc.indexOf("const PANEL_CHARS ="),
  panelSrc.indexOf("PANEL_CHARS_CANAL")
);
const literals = highlandBlock.match(/#[0-9A-Fa-f]{6}/g) ?? [];
assert.equal(
  literals.length,
  0,
  `高山面板段里出现了 ${literals.length} 个硬编码色值（${literals.slice(0, 6).join(" ")}）——` +
    "这正是漂移的根因，必须从色板派生"
);
ok("高山面板段 0 个硬编码色值");

console.log("[3] 派生结果与色板逐位一致");
// 复算面板实际会显示的色块，与色板比对（等价于运行时那两行 Object.fromEntries）
const derived = {
  ...Object.fromEntries(TOWNSCAPER_HIGHLAND_PALETTE.map((e) => [e.char, hex6(e.color)])),
  G: hex6(TOWNSCAPER_HIGHLAND_GATE_COLOR),
};
assert.equal(
  Object.keys(derived).length,
  TOWNSCAPER_HIGHLAND_PALETTE.length + 1,
  "派生表应覆盖 15 个色槽 + 正门"
);
for (const entry of TOWNSCAPER_HIGHLAND_PALETTE) {
  const shown = derived[entry.char];
  const real = hex6(entry.color);
  assert.equal(shown, real, `字符 ${entry.char}（${entry.name}）面板 ${shown} ≠ 实际 ${real}`);
  assert.equal(dist(shown, real), 0, `字符 ${entry.char} RGB 距离必须为 0`);
}
ok(`15 个色槽 + 正门逐位一致（RGB 距离全为 0）`);

console.log("[4] 运河那套仍然自洽（它是另一份手写表，别一起漂）");
const canalBlock = panelSrc.slice(panelSrc.indexOf("const PANEL_CHARS_CANAL ="));
const canalMap = {};
for (const [, char, value] of canalBlock.matchAll(/([0-9A-EG])\s*:\s*"(#[0-9A-Fa-f]{6})"/g)) {
  canalMap[char] = value.toUpperCase();
}
let canalChecked = 0;
for (const entry of TOWNSCAPER_CANAL_PALETTE) {
  const shown = canalMap[entry.char];
  if (!shown) continue;
  const d = dist(shown, hex6(entry.color));
  assert.ok(
    d <= 8,
    `运河字符 ${entry.char}（${entry.name}）面板 ${shown} 与实际 ${hex6(entry.color)} 距离 ${d}`
  );
  canalChecked++;
}
assert.ok(canalChecked >= 15, `运河应比对到 15 个色槽，实际 ${canalChecked}`);
ok(`运河 ${canalChecked} 个色槽一致（这套没坏，保持原样）`);

console.log("[5] 松石绿是青绿（本次主人问的那个）");
const c = TOWNSCAPER_HIGHLAND_PALETTE.find((e) => e.char === "C");
assert.ok(c, "色板必须有字符 C");
assert.equal(c.name, "松石绿", `字符 C 应叫松石绿，实际「${c.name}」`);
const [cr, cg, cb] = rgb(hex6(c.color));
assert.ok(cg > cr && cb > cr, `松石绿必须是青绿（G/B 高于 R），实际 ${hex6(c.color)}`);
ok(`C = 松石绿 ${hex6(c.color)}（G=${cg} B=${cb} > R=${cr}）`);

console.log(`\n全部通过：${pass} 项`);
console.log(
  "高山色板：" +
    TOWNSCAPER_HIGHLAND_PALETTE.map((e) => `${e.char}=${e.name}${hex6(e.color)}`).join(" ")
);
