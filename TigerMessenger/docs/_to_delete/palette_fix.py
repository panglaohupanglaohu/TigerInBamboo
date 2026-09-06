# -*- coding: utf-8 -*-
"""townscaper.html 的色板与生产不是同一份：菜单是硬编码土黄/砖红，建出来是马卡龙。"""
import io, os, re
R = os.path.expanduser("~/mnt/TigerInBamboo/")
p = R + "TigerMessenger/townscaper.html"
s = io.open(p, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    s = s.replace(old, new, 1)

# ---- 1. 导入生产色板 ----
rep("""import {
  CITADEL_TOWN_SPEC, CITADEL_LEVELS_KEY, levelsToGrid, gridToLevels, setCell, clearCell,
  CITADEL_PALETTE, CITADEL_GATE_CHAR, CITADEL_GATE_COLOR, migrateLegacyTownChars,
} from "./src/world/citadelTown.js";""",
"""import {
  CITADEL_TOWN_SPEC, CITADEL_LEVELS_KEY, levelsToGrid, gridToLevels, setCell, clearCell,
  CITADEL_GATE_CHAR, migrateLegacyTownChars,
  TOWNSCAPER_HIGHLAND_PALETTE, TOWNSCAPER_HIGHLAND_GATE_COLOR,
} from "./src/world/citadelTown.js";""", "import")

# ---- 2. CHAR_COLORS 换源 ----
rep("""const CHAR_COLORS = {};
for (const entry of CITADEL_PALETTE) CHAR_COLORS[entry.char] = entry.color;
CHAR_COLORS[CITADEL_GATE_CHAR] = CITADEL_GATE_COLOR;
CHAR_COLORS.W = CHAR_COLORS["0"];""",
"""// 色板只有一个来源：生产用哪份，编辑器就显示哪份。
// 这个文件历史上是「菜单一份硬编码十六进制 + 生产一份色板」，结果菜单写着砖红、
// 建出来是薄荷——主人 2026-09-05 报「配色都与自己菜单对不上」就是这个。
// 同样的病 citadelEditorPanel.js 已经犯过两次并在注释里写明了，这是第三次。
const EDITOR_PALETTE = TOWNSCAPER_HIGHLAND_PALETTE;
const CHAR_COLORS = {};
for (const entry of EDITOR_PALETTE) CHAR_COLORS[entry.char] = entry.color;
CHAR_COLORS[CITADEL_GATE_CHAR] = TOWNSCAPER_HIGHLAND_GATE_COLOR;
CHAR_COLORS.W = CHAR_COLORS["0"];
const CHAR_NAMES = { [CITADEL_GATE_CHAR]: "正门" };
for (const entry of EDITOR_PALETTE) CHAR_NAMES[entry.char] = entry.name;

// 按钮的色块与文字一律**运行时**从色板生成，HTML 里那串十六进制只是占位，
// 保证以后改色板不可能再漏改菜单。
for (const btn of document.querySelectorAll(".pal")) {
  const ch = btn.dataset.char;
  const hex = CHAR_COLORS[ch];
  if (hex === undefined) continue;
  const sw = btn.querySelector(".swatch");
  if (sw) sw.style.background = "#" + hex.toString(16).padStart(6, "0");
  const label = CHAR_NAMES[ch];
  if (label) btn.lastChild.textContent = label;
}""", "CHAR_COLORS")

# ---- 3. 用生产的高山配色建城 ----
rep("""  const assembly = buildCitadelTownAssembly(spec);""",
"""  // highlandColors:true —— 与游戏内高山圣城完全同一条配色/材质路径。
  // 不传的话会回落到旧的 CITADEL_PALETTE（4 个色重复成 15 档的淡彩），
  // 编辑器预览的就不是玩家会看到的城。
  const assembly = buildCitadelTownAssembly(spec, { highlandColors: true });""", "build")

io.open(p, "w", encoding="utf-8").write(s)
print("townscaper.html 已改")

# ---- 4. 加一条守门测试 ----
t = R + "tools/test_editor_palette_parity.mjs"
io.open(t, "w", encoding="utf-8").write('''// =====================================================================
// 编辑器色板一致性（主人 2026-09-05 报「高山城堡配色与菜单对不上」）
//
// 这个病在本仓库犯过三次，形态完全一样：**面板一份硬编码十六进制、生产一份
// 色板**，改了色板忘了改面板。citadelEditorPanel.js 的注释里记了前两次；
// 第三次在 townscaper.html。所以这里不测颜色好不好看，只测**只有一个来源**：
//
//   ① townscaper.html 的色块底色必须在运行时从色板生成，不得留硬编码 hex；
//   ② townscaper.html 必须走 highlandColors 这条生产路径，
//      否则预览用旧 CITADEL_PALETTE、游戏用 TOWNSCAPER_HIGHLAND_PALETTE，两边必然不一样；
//   ③ 游戏内面板 citadelEditorPanel.js 同样不得手抄十六进制。
//
// 运行：node tools/test_editor_palette_parity.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");

// ---------- ① 菜单色块不得硬编码 ----------
{
  const html = read("../TigerMessenger/townscaper.html");
  const palButtons = html.match(/<button data-char=[^>]*>[\\s\\S]*?<\\/button>/g) ?? [];
  assert.ok(palButtons.length >= 15, `色板按钮只找到 ${palButtons.length} 个`);
  assert.ok(
    /for \\(const btn of document\\.querySelectorAll\\("\\.pal"\\)\\)/.test(html),
    "townscaper.html 必须在运行时用色板刷新 .pal 按钮的色块与文字"
  );
  assert.ok(
    /sw\\.style\\.background = "#" \\+ hex\\.toString\\(16\\)/.test(html),
    "色块底色必须来自 CHAR_COLORS，不能只靠 HTML 里的静态 style"
  );
  console.log(`  ✓ ① 菜单 ${palButtons.length} 个色块运行时取色`);
}

// ---------- ② 预览必须走生产配色路径 ----------
{
  const html = read("../TigerMessenger/townscaper.html");
  assert.ok(
    /buildCitadelTownAssembly\\(spec, \\{ highlandColors: true \\}\\)/.test(html),
    "townscaper.html 必须传 highlandColors:true，否则预览的是旧 CITADEL_PALETTE 而不是玩家看到的城"
  );
  assert.ok(
    /TOWNSCAPER_HIGHLAND_PALETTE/.test(html),
    "townscaper.html 的 CHAR_COLORS 必须从 TOWNSCAPER_HIGHLAND_PALETTE 派生"
  );
  console.log("  ✓ ② 预览与生产同一条配色路径");
}

// ---------- ③ 游戏内面板同样不手抄 ----------
{
  const panel = read("../TigerMessenger/src/ui/citadelEditorPanel.js");
  assert.ok(
    /TOWNSCAPER_HIGHLAND_PALETTE\\.map\\(/.test(panel),
    "citadelEditorPanel.js 必须从色板派生色块，不得手抄十六进制"
  );
  console.log("  ✓ ③ 游戏内面板从色板派生");
}

console.log("✅ test_editor_palette_parity（色板只有一个来源）");
''')
print("已写 tools/test_editor_palette_parity.mjs")
