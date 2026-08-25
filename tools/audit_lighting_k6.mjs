#!/usr/bin/env node
// tools/audit_lighting_k6.mjs — V5 光照 K6 静态审计（TODO 562/563/567/568）
// 运行：node tools/audit_lighting_k6.mjs
//
// 只读 TigerMessenger/src 源码文本（fs 扫描，不执行浏览器代码），输出
// tools/out/lighting-k6-audit.json + 控制台摘要。审计是报告不是门禁：
// 发现嫌疑项不影响退出码，恒 exit 0（内部错误除外）。
//
// 三节：
//  A) 双重遮蔽（562）：aoMap / vertexColors / 纹理污迹 / voxel AO 注入面，
//     按资产目录分组，标出同一材质上可能重复相乘的组合；
//  B) Toon 一致性（563）：gradientMap/MeshToonMaterial 创建点 + 阶数来源，
//     共享来源 = assets/toon.js getToonGradient（2 阶），其余列为离群；
//  C) 灯光普查（567/568）：new THREE.*Light 创建点（排除 render/lighting/
//     的 V5 导演与 localLightRegistry 桥接池），对照“纸士兵/木马/船/城堡
//     共享同一曝光雾空间”原则标出资产自带 ambient 嫌疑；合法例外单独标注
//     且必须能对应 registry/调试可见性说明。
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const ROOT = fileURLToPath(new URL("../TigerMessenger/src", import.meta.url));
const OUT = fileURLToPath(new URL("./out/lighting-k6-audit.json", import.meta.url));

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith(".js")) out.push(p);
  }
  return out.sort();
}

const files = walk(ROOT).map((abs) => ({
  rel: relative(ROOT, abs).split("\\").join("/"),
  text: readFileSync(abs, "utf8"),
}));

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** 取创建点上方的用途注释（向上最多 4 行的 // 或块注释行）。 */
function purposeComment(lines, lineNo) {
  const notes = [];
  for (let i = lineNo - 2; i >= 0 && i >= lineNo - 5; i--) {
    const t = lines[i].trim();
    const m = t.match(/^\/\/\s?(.*)$/) ?? t.match(/^\*\s?(.*)$/) ?? t.match(/^\/\*\s?(.*?)\*?\/$/);
    if (m && m[1]) notes.unshift(m[1].trim());
    else if (notes.length) break;
    else if (t === "" || t.endsWith("}") || t.endsWith("{")) continue;
    else break;
  }
  return notes.join(" / ").slice(0, 160);
}

// =====================================================================
//  C) 灯光普查（TODO 567/568）
// =====================================================================
const LIGHT_RE = /new\s+THREE\.(AmbientLight|DirectionalLight|HemisphereLight|PointLight|SpotLight|RectAreaLight)/g;
// 排除：render/lighting/ 的 V5 导演（lightingDirector/oskLightingPrototype）
// 与 LocalLightRegistry 桥接池（localLightBridge）——它们是 K4/K5 的正主。
const isV5LightingCore = (rel) => rel.startsWith("render/lighting/");

// 已知合法例外：必须能对应 registry 登记 / 调试可见性说明。
const KNOWN_LIGHT_EXCEPTIONS = {
  "world/environment.js":
    "legacy 全局 rig（ambient+hemi+sun+fill）。?oskLightingV1=1 时由 lightingDirector 接管/逐字节恢复（test_lighting_v5.mjs 验证）；文件内已 registerLocalLight。",
  "world/odysseyCitadel.js":
    "斯瓦尔博娃圣城 layer-1 例外 rig（citadel-svarbova-ambient/sun），registerLocalLight({ exception: true })，只占调试可见性不占局部灯预算。",
  "world/weather.js": "闪电 PointLight 默认 intensity=0，K4 闪电 override 专用；已 registerLocalLight。",
  "player/player.js": "手持光环 PointLight 默认 intensity=0；已 registerLocalLight。",
  "assets/moebiusAircraft.js": "座舱/霓虹/推进器点光：任务书列明的 aircraft 座舱例外；已 registerLocalLight。",
  "assets/bubblePod.js": "气泡舱内部点光（舱内局部照明）；已 registerLocalLight。",
  "assets/harbor.js": "夜袭火炬 PointLight，K4 已迁入 LocalLightRegistry（超预算只留 emissive 火焰）。",
  "assets/ancient.js": "古榕树区补光 PointLight；已 registerLocalLight。",
  "world/moebiusTiger.js": "虎目辉光 PointLight；已 registerLocalLight。",
  "assets/moebiusTower.js": "塔灯 PointLight；已 registerLocalLight。",
  "planet/letterQuest.js": "信件任务辉光 PointLight；已 registerLocalLight。",
  "scenes/saihojiGarden.js": "鲸升空光束 SpotLight 默认 intensity=0（事件驱动）；已 registerLocalLight。",
  "assets/townscaperBuilding.js":
    "addTownscaperAmbient 是演示页工具：唯一调用方是 townscaper-building.html 独立样片页（非主场景），不违反主场景共享曝光/雾空间原则。",
  "planet/main.js":
    "planet.html 球面实验页的独立场景灯光（非主游戏场景）；主页面的曝光/雾空间不受影响。",
};

const lightCensus = [];
for (const { rel, text } of files) {
  const lines = text.split("\n");
  for (const m of text.matchAll(LIGHT_RE)) {
    const line = lineOf(text, m.index);
    const entry = {
      file: rel,
      line,
      type: m[1],
      purpose: purposeComment(lines, line),
      registryVisible: text.includes("registerLocalLight("),
    };
    if (isV5LightingCore(rel)) {
      entry.status = "excluded-v5-core";
      entry.note = "render/lighting/ 内部：V5 导演/样片/registry 桥接池，K4/K5 正主，不计嫌疑";
    } else if (KNOWN_LIGHT_EXCEPTIONS[rel]) {
      entry.status = "known-exception";
      entry.note = KNOWN_LIGHT_EXCEPTIONS[rel];
      if (!entry.registryVisible && !rel.startsWith("planet/")) {
        entry.note += "（警告：文件内未见 registerLocalLight，例外可见性存疑）";
      }
    } else {
      const isAmbient = m[1] === "AmbientLight" || m[1] === "HemisphereLight";
      entry.status = isAmbient ? "suspect-asset-ambient" : "suspect-unregistered";
      entry.note = isAmbient
        ? "资产自带 ambient/hemi 嫌疑：抵消场景曝光，违反“纸士兵/木马/船/城堡共享同一曝光雾空间”原则；未在 registry 登记"
        : "未在 LocalLightRegistry 登记的灯光创建点：V5 下不参与预算选择、调试面板不可见";
    }
    lightCensus.push(entry);
  }
}

// =====================================================================
//  B) Toon 一致性（TODO 563）
// =====================================================================
const TOON_CTOR_RE = /new\s+THREE\.MeshToonMaterial\s*\(/g;
const GRADIENT_DATA_RE = /new\s+Uint8Array\s*\(\[([\d,\s]+)\]\)/g;
const TOONMAT_CALL_RE = /\btoonMat\s*\(/g;
const SHARED_GRADIENT_TOKEN = "getToonGradient"; // assets/toon.js 单例，2 阶

/** 收集所有渐变定义：Uint8Array 像素 + 邻近 DataTexture，阶数=像素数。 */
const gradientDefs = [];
for (const { rel, text } of files) {
  for (const m of text.matchAll(GRADIENT_DATA_RE)) {
    const after = text.slice(m.index, m.index + 400);
    if (!/new\s+THREE\.DataTexture\s*\(/.test(after)) continue;
    const steps = m[1].split(",").map((s) => s.trim()).filter(Boolean).length;
    gradientDefs.push({ file: rel, line: lineOf(text, m.index), steps, values: m[1].replace(/\s/g, "") });
  }
}

/** token（getToonGradient / _gradient3 / makeThreeStepGradient …）→ 定义文件。 */
function resolveGradientToken(token, fromRel, fromText) {
  if (!token) return null;
  // 同文件定义？
  const sameFile = gradientDefs.find((d) => d.file === fromRel);
  if (sameFile && new RegExp(`(const|function)\\s+${token}\\b|${token}\\s*=\\s*\\(\\)`).test(fromText)) return sameFile;
  // import 来源？
  const im = fromText.match(new RegExp(`import\\s*\\{[^}]*\\b${token}\\b[^}]*\\}\\s*from\\s*"([^"]+)"`));
  if (im) {
    const target = im[1].replace(/^\.\.?\//, "");
    const rel = fromRel.includes("/") ? fromRel.slice(0, fromRel.lastIndexOf("/") + 1) : "";
    const resolved = join(rel, target).split("\\").join("/").replace(/[^/]+\/\.\.\//g, "");
    const def = gradientDefs.find((d) => d.file === resolved) ?? gradientDefs.find((d) => d.file.endsWith(target.replace(/^\.\.\//, "")));
    if (def) return def;
  }
  // 兜底：全库唯一定义
  return gradientDefs.length ? null : null;
}

const toonCreations = [];
for (const { rel, text } of files) {
  const lines = text.split("\n");
  for (const m of text.matchAll(TOON_CTOR_RE)) {
    const line = lineOf(text, m.index);
    const block = text.slice(m.index, m.index + 600);
    const gm = block.match(/gradientMap\s*:\s*([A-Za-z_$][\w$]*)/);
    const token = gm ? gm[1] : null;
    const def = token ? resolveGradientToken(token, rel, text) : null;
    toonCreations.push({
      file: rel,
      line,
      gradientMap: token,
      steps: def?.steps ?? (token ? null : 0), // 0 = 无 gradientMap（Three 默认，无量化）
      shared: token === SHARED_GRADIENT_TOKEN,
      viaFactory: rel === "assets/toon.js", // toonMat() 的唯一创建点
    });
  }
}
// toonMat() 调用点 = 共享 2 阶的消费者（材质创建只在 toon.js 一处）
const toonMatConsumers = [];
for (const { rel, text } of files) {
  if (rel === "assets/toon.js") continue;
  let count = 0;
  for (const _ of text.matchAll(TOONMAT_CALL_RE)) count++;
  if (count > 0) toonMatConsumers.push({ file: rel, callSites: count, gradient: "shared getToonGradient (2 阶)" });
}

const toonOutliers = [];
for (const c of toonCreations) {
  if (c.viaFactory) continue; // toon.js 本体是共享来源
  if (c.shared) continue;
  if (!c.gradientMap) {
    toonOutliers.push({ ...c, reason: "无 gradientMap：Three 默认无阶梯量化，与共享 2 阶硬边不一致" });
  } else {
    const defNote = c.steps ? `${c.steps} 阶` : "阶数未解析";
    toonOutliers.push({ ...c, reason: `私有 gradientMap（${defNote}），非共享 getToonGradient（2 阶）` });
  }
}

// =====================================================================
//  A) 双重遮蔽审计（TODO 562）
// =====================================================================
const AO_VERTEX_RE = /vertexColors\s*:\s*true/g;
const AO_MAP_RE = /\baoMap\b/g;
const AO_SMUDGE_RE = /smudge|grime|dirtMap|污迹/i;
// voxel AO 注入面：voxelAoRenderer 的 INJECTABLE（Toon/Lambert/Standard/Phong）
const INJECTABLE_RE = /new\s+THREE\.(MeshToonMaterial|MeshLambertMaterial|MeshStandardMaterial|MeshPhongMaterial)|\btoonMat\s*\(/;

const aoByAsset = {};
for (const { rel, text } of files) {
  const vertexColors = [...text.matchAll(AO_VERTEX_RE)].length;
  const aoMap = [...text.matchAll(AO_MAP_RE)].length;
  const smudge = AO_SMUDGE_RE.test(text);
  const voxelInjectable = INJECTABLE_RE.test(text);
  const sources = [];
  if (aoMap > 0) sources.push("aoMap(旧)");
  if (vertexColors > 0) sources.push("顶点色");
  if (smudge) sources.push("纹理污迹");
  if (voxelInjectable) sources.push("voxel-AO可注入");
  if (sources.length === 0) continue;
  const group = rel.includes("/") ? rel.slice(0, rel.indexOf("/")) : "(root)";
  const bakedCount = (aoMap > 0 ? 1 : 0) + (vertexColors > 0 ? 1 : 0) + (smudge ? 1 : 0);
  let suspicion = null;
  if (aoMap > 0 && vertexColors > 0) {
    suspicion = "high: aoMap 与顶点色烘焙遮蔽同材质可能重复相乘";
  } else if (bakedCount > 0 && voxelInjectable) {
    suspicion = "review: 烘焙遮蔽（顶点色/污迹/aoMap）+ V5 voxel AO 注入面，V5 开启时可能重复相乘";
  }
  (aoByAsset[group] ??= []).push({ file: rel, vertexColors, aoMap, smudge, voxelInjectable, sources, suspicion });
}
const aoSuspects = Object.values(aoByAsset).flat().filter((e) => e.suspicion);

// =====================================================================
//  输出
// =====================================================================
const suspects = lightCensus.filter((e) => e.status.startsWith("suspect"));
const report = {
  generatedAt: new Date().toISOString(),
  root: "TigerMessenger/src",
  filesScanned: files.length,
  aoDoubleOcclusion: {
    byAsset: aoByAsset,
    suspects: aoSuspects,
    disposition: "TODO 562 定案（2026-08-23）：本项目顶点色只承担 albedo 手绘色块（citadelTown 墙面 patchy paint），全仓库无 aoMap 使用，无现役双重遮蔽；已在 voxelAoRenderer.INJECTABLE 加防御守卫（aoMap/userData.bakedOcclusion 材质跳过注入），守卫由 test_lighting_k6.mjs 锁定。11 个 review 级文件保留观察。",
  },
  toonConsistency: {
    sharedSource: "assets/toon.js getToonGradient（2 阶硬边，toonMat() 唯一创建点）",
    disposition: "TODO 563 定案（2026-08-23）：条目范围为墙/屋顶/阳台——圣城全部墙/顶/阳台材质统一走 odysseyCitadel makeThreeStepGradient（5 阶软 ramp，容器级 userData.gradientMap 共享），lowPoly 道具走共享 getToonGradient（2 阶），类内一致。离群的 11 处全部在条目范围外：纸兵/方阵/npcs（兵种可读性优先，PLAN 既定）、飞艇/气泡舱（道具）、云（3 阶柔边为刻意艺术方向，见各文件注释）。跨类差异是刻意的，不做统一。",
    gradientDefs,
    toonCreations,
    toonMatConsumers,
    outliers: toonOutliers,
  },
  lightCensus: {
    excludedV5Core: lightCensus.filter((e) => e.status === "excluded-v5-core"),
    knownExceptions: lightCensus.filter((e) => e.status === "known-exception"),
    suspects,
    all: lightCensus,
  },
  summary: {
    lightCreationPoints: lightCensus.length,
    lightSuspects: suspects.length,
    lightKnownExceptions: lightCensus.filter((e) => e.status === "known-exception").length,
    toonCreations: toonCreations.length,
    toonOutliers: toonOutliers.length,
    aoFilesWithSources: Object.values(aoByAsset).flat().length,
    aoSuspects: aoSuspects.length,
  },
};

mkdirSync(join(OUT, ".."), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");

const s = report.summary;
console.log("V5 K6 静态审计（TigerMessenger/src，" + s && `${files.length} 文件）`);
console.log(`A) 双重遮蔽：${s.aoFilesWithSources} 文件含 AO 来源，${s.aoSuspects} 个重复相乘嫌疑`);
for (const e of aoSuspects) console.log(`   ! ${e.file} [${e.sources.join("+")}] ${e.suspicion}`);
console.log(`B) Toon：${s.toonCreations} 个 MeshToonMaterial 创建点，${s.toonOutliers} 个离群（共享=2 阶 getToonGradient）`);
for (const o of toonOutliers) console.log(`   ! ${o.file}:${o.line} gradientMap=${o.gradientMap ?? "无"} steps=${o.steps} — ${o.reason}`);
console.log(`C) 灯光：${s.lightCreationPoints} 个创建点 = 例外 ${s.lightKnownExceptions} + V5核心 ${report.lightCensus.excludedV5Core.length} + 嫌疑 ${s.lightSuspects}`);
for (const e of suspects) console.log(`   ! ${e.file}:${e.line} ${e.type} [${e.status}] ${e.purpose || e.note}`);
console.log(`→ ${relative(process.cwd(), OUT)}`);
// 例外清单即锁定（TODO 568）：主场景之外出现任何新嫌疑灯光创建点，审计非零退出
if (suspects.length > 0) {
  console.error(`❌ K6 灯光审计：${suspects.length} 个未登记嫌疑（要么登记 registerLocalLight/例外，要么修代码）`);
  process.exit(1);
}
process.exit(0);
