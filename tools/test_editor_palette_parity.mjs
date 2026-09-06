// =====================================================================
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
  const palButtons = html.match(/<button data-char=[^>]*>[\s\S]*?<\/button>/g) ?? [];
  assert.ok(palButtons.length >= 15, `色板按钮只找到 ${palButtons.length} 个`);
  assert.ok(
    /for \(const btn of document\.querySelectorAll\("\.pal"\)\)/.test(html),
    "townscaper.html 必须在运行时用色板刷新 .pal 按钮的色块与文字"
  );
  assert.ok(
    /sw\.style\.background = "#" \+ hex\.toString\(16\)/.test(html),
    "色块底色必须来自 CHAR_COLORS，不能只靠 HTML 里的静态 style"
  );
  console.log(`  ✓ ① 菜单 ${palButtons.length} 个色块运行时取色`);
}

// ---------- ② 预览必须走生产配色路径 ----------
{
  const html = read("../TigerMessenger/townscaper.html");
  assert.ok(
    /buildCitadelTownAssembly\(spec, \{ highlandColors: true \}\)/.test(html),
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
    /TOWNSCAPER_HIGHLAND_PALETTE\.map\(/.test(panel),
    "citadelEditorPanel.js 必须从色板派生色块，不得手抄十六进制"
  );
  console.log("  ✓ ③ 游戏内面板从色板派生");
}

console.log("✅ test_editor_palette_parity（色板只有一个来源）");
