// =====================================================================
// 探针：搭建面板色块 vs 实际渲染墙色（只读）
// 用法：node tools/probe_palette_match.mjs
//
// 面板 PANEL_CHARS 是硬编码的十六进制串，实际墙色来自
// odysseyCitadel.js 选出的 townPalette：
//   isCitadelPaletteV3() ? v3HighlandWallPalette() : TOWNSCAPER_HIGHLAND_PALETTE
// 三个色源各写一处，对不上就是「选了松石绿、建出来是白石」。
// =====================================================================
const SRC = new URL("../TigerMessenger/src/", import.meta.url);
const { TOWNSCAPER_HIGHLAND_PALETTE, TOWNSCAPER_CANAL_PALETTE } =
  await import(new URL("world/citadelTown.js", SRC).href);
const theme = await import(new URL("world/citadelVisualTheme.js", SRC).href);
const params = await import(new URL("core/params.js", SRC).href);

// 与 citadelEditorPanel.js 的 PANEL_CHARS 逐字一致（那边是 UI 文件，不能在 node 里 import DOM）
const PANEL_CHARS = {
  0: "#FFEDC4", 1: "#F0C37C", 2: "#F28E82", 3: "#F6DD45", 4: "#F08A3C",
  5: "#EF4F67", 6: "#D94F7D", 7: "#46D88E", 8: "#31C46F", 9: "#4F9DE9",
  A: "#3F88DB", B: "#63D54D", C: "#32CBB2", D: "#B06CCA", E: "#5F78D1",
};
const CHAR_NAMES = {
  0: "奶油白", 1: "暖砂石", 2: "杏粉", 3: "奶油黄", 4: "蜜橙", 5: "珊瑚红", 6: "覆盆子",
  7: "薄荷绿", 8: "翡翠绿", 9: "天青", A: "湖蓝", B: "鲜草绿", C: "松石绿", D: "灰紫",
  E: "钴蓝",
};

const hex = (n) => `#${n.toString(16).padStart(6, "0").toUpperCase()}`;
const toRgb = (s) => {
  const v = parseInt(String(s).replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
/** 粗略感知距离：RGB 欧氏距离（够用来判「是不是同一个颜色」） */
const dist = (a, b) => {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return Math.round(Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2));
};

const v3On = typeof theme.isCitadelPaletteV3 === "function" ? theme.isCitadelPaletteV3() : null;
console.log(`isCitadelPaletteV3() = ${v3On}`);
console.log(`P.citadelPaletteV3 = ${params.P?.citadelPaletteV3}`);
console.log(`FEATURES.citadelPaletteV3 = ${params.FEATURES?.citadelPaletteV3}\n`);

let v3 = null;
if (typeof theme.v3HighlandWallPalette === "function") {
  try {
    v3 = theme.v3HighlandWallPalette();
  } catch (e) {
    console.log(`v3HighlandWallPalette() 抛错：${e.message}`);
  }
}

const actual = v3On && v3 ? v3 : TOWNSCAPER_HIGHLAND_PALETTE;
console.log(`实际生效的色板 = ${v3On && v3 ? "v3HighlandWallPalette()" : "TOWNSCAPER_HIGHLAND_PALETTE"}`);
console.log(`（若 V3 开关默认关，那就是 TOWNSCAPER_HIGHLAND_PALETTE）\n`);

const byChar = new Map(actual.map((e) => [e.char, e]));
console.log("字符  面板名        面板色块    实际名          实际色      RGB 距离");
console.log("".padEnd(76, "-"));
let bad = 0;
for (const char of Object.keys(PANEL_CHARS)) {
  const panel = PANEL_CHARS[char];
  const e = byChar.get(char);
  if (!e) {
    console.log(`${char}     ${CHAR_NAMES[char].padEnd(12)} ${panel}    (实际色板里没有这个字符)`);
    bad++;
    continue;
  }
  const real = hex(e.color);
  const d = dist(panel, real);
  const flag = d > 60 ? "  ❌ 对不上" : d > 25 ? "  ⚠️ 偏" : "  ✓";
  if (d > 60) bad++;
  console.log(
    `${char}     ${CHAR_NAMES[char].padEnd(12)} ${panel}    ${String(e.name).padEnd(14)} ${real}    ${String(d).padStart(4)}${flag}`
  );
}
console.log("".padEnd(76, "-"));
console.log(`明显对不上（RGB 距离 > 60）的字符：${bad} / ${Object.keys(PANEL_CHARS).length}`);

const c = byChar.get("C");
if (c) {
  console.log(
    `\n本次问的 C：面板「${CHAR_NAMES.C}」${PANEL_CHARS.C} → 实际「${c.name}」${hex(c.color)}，` +
      `RGB 距离 ${dist(PANEL_CHARS.C, hex(c.color))}`
  );
}

// 运河色板是另一套，面板也另有 PANEL_CHARS_CANAL，这里只报数字供对照
console.log(`\n参考：运河色板 ${TOWNSCAPER_CANAL_PALETTE.length} 色，C = ${
  hex(TOWNSCAPER_CANAL_PALETTE.find((e) => e.char === "C")?.color ?? 0)
}（面板 canal 版 C = #86C9BE）`);
