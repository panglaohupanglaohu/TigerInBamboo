#!/usr/bin/env node
/**
 * 重构第 1 步 · 盘点：扫描 src 下所有 JS，列出可以统一的重复实现。
 *   材质构造 / 调色板 / 灯光 / 建房函数 / 载具与乘骑 / 交互入口，按场景与风格包归类。
 * 只读源码，不改任何文件。输出：
 *   docs/STYLE_INVENTORY.md     人读的汇总
 *   artifacts/refactor/inventory.json   全量明细（供第 2、3 步脚本使用）
 * 用法（仓库 TigerMessenger 目录下）：node tools/refactor/inventory.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || '.';
const SRC = path.join(ROOT, 'src');
const SKIP = /\/(vendor|node_modules)\//;

// 场景前缀 → 风格包（与规划文档一致，待用户确认）
const SCENE_PACK = {
  morris: '莫里斯', crystal: '莫比斯', gate: '莫比斯', moebius: '莫比斯', abandoned: '莫比斯',
  bookshop: '蒸汽朋克', batian: '蒸汽朋克', swamp: '湖沼珊瑚', greg: '湖沼珊瑚',
  citadel: 'Townscaper', highland: 'Townscaper', apostles: 'Townscaper', apostle: 'Townscaper',
  saihoji: '日式苔园', twelve: 'Townscaper',
  // 角色是「物件」，不属于某个场景风格包
  tiger: '角色（物件）', courier: '角色（物件）', robot: '角色（物件）', messenger: '角色（物件）', duke: '角色（物件）', npc: '角色（物件）', vanguard: '角色（物件）',
};
const sceneOf = (rel) => {
  const parts = rel.split('/');
  if (parts.includes('citadel')) return 'citadel';
  const base = parts.at(-1).replace(/\.js$/, '');
  const m = base.match(/^[a-z]+/);
  return m ? m[0] : 'shared';
};
const packOf = (scene) => SCENE_PACK[scene] || '共用 / 未归类';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (SKIP.test(p + '/')) continue;
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
/** 从 i（指向 '(' 或 '{'）起找配对括号，返回内部文本（上限 1500 字符） */
function balanced(s, i) {
  const open = s[i], close = open === '(' ? ')' : open === '{' ? '}' : ']';
  let d = 0;
  for (let j = i; j < s.length && j < i + 4000; j++) {
    if (s[j] === open) d++; else if (s[j] === close && --d === 0) return s.slice(i + 1, j);
  }
  return s.slice(i + 1, i + 1500);
}
const COLOR_RE = /0x[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{6}\b/g;
const normColor = (c) => '#' + c.replace(/^0x|^#/, '').toLowerCase();
const lineOf = (s, i) => s.slice(0, i).split('\n').length;

const files = walk(SRC);
const inv = { generatedAt: new Date().toISOString(), files: files.length, materials: [], palettes: [], lights: [], buildings: [], vehicles: [], interactions: [] };
for (const f of files) {
  const rel = path.relative(ROOT, f), s = fs.readFileSync(f, 'utf8'), scene = sceneOf(rel), pack = packOf(scene);
  // 材质
  for (const m of s.matchAll(/new\s+(?:T|THREE)\.(Mesh\w*Material|LineBasicMaterial|PointsMaterial|SpriteMaterial|ShaderMaterial)\s*\(/g)) {
    const body = balanced(s, m.index + m[0].length - 1);
    inv.materials.push({ file: rel, line: lineOf(s, m.index), scene, pack, type: m[1], colors: [...new Set((body.match(COLOR_RE) || []).map(normColor))], literal: /^\s*\{[^{}]*\}\s*$/.test(body), opts: body.slice(0, 160).replace(/\s+/g, ' ') });
  }
  // 调色板：名字像调色板的常量，或 ≥4 个颜色字面量的对象 / 数组常量
  for (const m of s.matchAll(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:Object\.freeze\()?\s*([{[])/g)) {
    const body = balanced(s, m.index + m[0].length - 1), colors = (body.match(COLOR_RE) || []).map(normColor);
    if (colors.length >= 4 || (/palette|colou?rs?|tones?|swatch|tint/i.test(m[1]) && colors.length)) inv.palettes.push({ file: rel, line: lineOf(s, m.index), scene, pack, name: m[1], colorCount: colors.length, colors: [...new Set(colors)] });
  }
  // 灯光
  for (const m of s.matchAll(/new\s+(?:T|THREE)\.(DirectionalLight|HemisphereLight|AmbientLight|PointLight|SpotLight)\s*\(/g)) inv.lights.push({ file: rel, line: lineOf(s, m.index), scene, pack, type: m[1] });
  // 建筑工厂
  for (const m of s.matchAll(/(?:function\s+|const\s+)((?:create|make|build|add)\w*(?:House|Building|Tower|Roof|Wall|Bridge|Gate|Dock|Pier|Temple|Church|Castle|Shrine|Hut|Window|Door|Stair)\w*)/g)) inv.buildings.push({ file: rel, line: lineOf(s, m.index), scene, pack, name: m[1] });
  // 载具 / 乘骑
  for (const m of s.matchAll(/(?:function\s+|const\s+)((?:create|make|build)\w*(?:Ride|Boat|Ship|Tram|Train|Airship|Aircraft|Car|Cart|Horse|Vehicle|Freighter|Pod|Rower)\w*)/g)) inv.vehicles.push({ file: rel, line: lineOf(s, m.index), scene, pack, name: m[1] });
  // 交互入口
  for (const m of s.matchAll(/(?:function\s+|const\s+|\b)((?:on)?(?:[iI]nteract|[dD]ialog(?:ue)?|[tT]alk|[gG]reet|[pP]rompt|[mM]ount|[bB]oard|[dD]ismount|[eE]nterRide|[eE]xitRide)\w*)\s*(?:=\s*(?:\([^)]*\)|\w+)\s*=>|\()/g)) inv.interactions.push({ file: rel, line: lineOf(s, m.index), scene, pack, name: m[1] });
}

// 汇总
const by = (rows, key) => rows.reduce((a, r) => ((a[r[key]] = (a[r[key]] || 0) + 1), a), {});
const colorUse = new Map();
for (const m of [...inv.materials, ...inv.palettes]) for (const c of m.colors) { if (!colorUse.has(c)) colorUse.set(c, new Set()); colorUse.get(c).add(m.file); }
inv.sharedColors = [...colorUse].map(([c, set]) => ({ color: c, files: set.size })).filter((x) => x.files >= 4).sort((a, b) => b.files - a.files);
inv.summary = {
  materials: inv.materials.length, materialsByType: by(inv.materials, 'type'), materialsByPack: by(inv.materials, 'pack'), literalMaterials: inv.materials.filter((m) => m.literal).length,
  palettes: inv.palettes.length, palettesByPack: by(inv.palettes, 'pack'), lights: inv.lights.length, lightsByPack: by(inv.lights, 'pack'),
  buildings: inv.buildings.length, buildingsByPack: by(inv.buildings, 'pack'), vehicles: inv.vehicles.length, vehiclesByPack: by(inv.vehicles, 'pack'),
  interactions: inv.interactions.length, interactionsByPack: by(inv.interactions, 'pack'),
  distinctColors: colorUse.size, colorsInFourPlusFiles: inv.sharedColors.length,
};
fs.mkdirSync(path.join(ROOT, 'artifacts/refactor'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts/refactor/inventory.json'), JSON.stringify(inv, null, 1));

// 人读报告
const packs = [...new Set([...Object.values(SCENE_PACK), '共用 / 未归类'])];
const sharedScenes = Object.entries(by(inv.materials.filter((m) => m.pack === '共用 / 未归类'), 'scene')).sort((a, b) => b[1] - a[1]);
const S = inv.summary, row = (o, k) => o[k] || 0;
const topFiles = (rows, n = 12) => Object.entries(by(rows, 'file')).sort((a, b) => b[1] - a[1]).slice(0, n);
let md = `# 风格重构 · 第 1 步盘点\n\n生成：${inv.generatedAt}（tools/refactor/inventory.mjs，只读扫描 src/ ${inv.files} 个 JS，不含 vendor）。明细：artifacts/refactor/inventory.json。\n\n`;
md += `## 总量\n\n| 类别 | 数量 | 说明 |\n| --- | --- | --- |\n`;
md += `| 材质构造 | ${S.materials} | ${Object.entries(S.materialsByType).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join('、')}；其中参数是纯字面量（可直接收编）的 ${S.literalMaterials} |\n`;
md += `| 调色板常量 | ${S.palettes} | 名字像调色板或含 ≥4 个颜色的常量 |\n| 颜色值 | ${S.distinctColors} 种 | 其中 ${S.colorsInFourPlusFiles} 种在 ≥4 个文件里重复出现 |\n`;
md += `| 灯光构造 | ${S.lights} | 各场景自建的方向光 / 半球光 / 环境光 / 点光 |\n| 建筑函数 | ${S.buildings} | 建房、塔、屋顶、墙、桥、门、窗、楼梯 |\n| 载具 / 乘骑函数 | ${S.vehicles} | 船、车、飞艇、飞行器、马、舱 |\n| 交互入口 | ${S.interactions} | 交互、对话、上下载具 |\n\n`;
md += `## 按风格包\n\n| 风格包 | 材质 | 调色板 | 灯光 | 建筑函数 | 载具 | 交互 |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
for (const p of packs) md += `| ${p} | ${row(S.materialsByPack, p)} | ${row(S.palettesByPack, p)} | ${row(S.lightsByPack, p)} | ${row(S.buildingsByPack, p)} | ${row(S.vehiclesByPack, p)} | ${row(S.interactionsByPack, p)} |\n`;
md += `\n「共用 / 未归类」里材质最多的前缀：${sharedScenes.slice(0, 16).map(([k, v]) => k + ' ' + v).join('、')}。这些多是跨场景的系统（月湖、运河、电车、港口、天气等），归入哪个风格包待定。\n`;
md += `\n## 材质最多的文件（优先收编）\n\n| 文件 | 材质数 |\n| --- | --- |\n` + topFiles(inv.materials).map(([f, n]) => `| \`${f}\` | ${n} |`).join('\n') + '\n';
md += `\n## 跨文件重复最多的颜色（候选「颜色角色」）\n\n| 颜色 | 出现的文件数 |\n| --- | --- |\n` + inv.sharedColors.slice(0, 20).map((c) => `| ${c.color} | ${c.files} |`).join('\n') + '\n';
md += `\n## 建筑函数\n\n| 风格包 | 函数（文件） |\n| --- | --- |\n` + packs.map((p) => [p, inv.buildings.filter((b) => b.pack === p)]).filter(([, r]) => r.length).map(([p, r]) => `| ${p} | ${r.map((b) => `${b.name}（${path.basename(b.file)}）`).join('、')} |`).join('\n') + '\n';
md += `\n## 载具 / 乘骑函数\n\n| 风格包 | 函数（文件） |\n| --- | --- |\n` + packs.map((p) => [p, inv.vehicles.filter((b) => b.pack === p)]).filter(([, r]) => r.length).map(([p, r]) => `| ${p} | ${r.map((b) => `${b.name}（${path.basename(b.file)}）`).join('、')} |`).join('\n') + '\n';
md += `\n## 下一步（第 2 步）\n\n先收编莫西斯湖：材质改由风格材质工厂按「角色」创建，参数原样；同相机、同光照截图对照必须一致。\n`;
fs.writeFileSync(path.join(ROOT, 'docs/STYLE_INVENTORY.md'), md);
console.log(JSON.stringify(S, null, 1));
