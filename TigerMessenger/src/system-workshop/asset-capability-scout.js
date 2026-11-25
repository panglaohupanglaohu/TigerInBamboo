/**
 * asset-capability-scout.js — 智能体资产表驱动 × REACode 能力雷达与快速重构方案引擎（纯逻辑，Node / 浏览器共用）。
 *
 * 核心原则：
 *   1. 不把重构前的 REACode 原型代码直接当成品引入（原版常带全局状态、DOM/渲染耦合、缺契约与验证）；
 *   2. 以本系统真实资产表（assets/models/inventory.json）+ 场景消费表 + REACode 对账表为输入，
 *      结合 JEV（tools/jev/ask.py）低成本批量研判，输出针对「球系统 / 场景系统 / 物件系统」的快速重构补充蓝图。
 */

export const SYSTEM_META = Object.freeze({
  planet: { id: 'planet', name: '球系统', short: '球', color: '#4fd1c5', desc: '星球球面网格、大洲地形、海洋潮汐、轨道云层与气候' },
  scene:  { id: 'scene',  name: '场景系统', short: '场景', color: '#8fd0a8', desc: '地形地貌、水岸瀑布、建筑群WFC、光照阴影、战役导航与植被氛围' },
  object: { id: 'object', name: '物件系统', short: '物件', color: '#f2b866', desc: '单体模型变形、门窗开孔、LOD/公告牌、网格质检、载具与角色道具' },
  multi:  { id: 'multi',  name: '跨系统公用', short: '跨层', color: '#a78bfa', desc: '同时增强球/场景/物件多个管线的底层图形或几何核' },
});

/** 资产表大类 → 关联的游戏管线系统、关注能力线与关键词 */
export const ASSET_CATEGORY_RULES = Object.freeze({
  '圣城与建筑':     { systems: ['scene', 'object'], lines: ['building', 'hallway', 'wfc', 'light'], keywords: ['roof', 'wall', 'house', 'tower', 'gate', 'arch', 'bridge', 'prop', 'hole', 'splice', 'prefab', 'socket', 'city', 'town'] },
  '地形与场景构件': { systems: ['scene', 'planet'], lines: ['terrain', 'shore', 'sediment', 'water-effects', 'sphere'], keywords: ['terrain', 'cliff', 'mesa', 'coast', 'shore', 'river', 'waterfall', 'slope', 'rock', 'island', 'sphere', 'contour', 'relax', 'blotch', 'normal'] },
  '载具':           { systems: ['object', 'scene'], lines: ['navigation', 'water-effects', 'camera', 'tools'], keywords: ['boat', 'ship', 'tram', 'rail', 'pod', 'aircraft', 'wake', 'traffic', 'path', 'nav', 'cage', 'deform'] },
  '渲染与辅助几何': { systems: ['multi', 'scene', 'planet'], lines: ['light', 'shadows', 'reflection', 'lines', 'palette', 'atlas'], keywords: ['light', 'shadow', 'outline', 'rim', 'backlit', 'reflect', 'fog', 'surface', 'vertex', 'megatex', 'atlas', 'meshcheck', 'impostor', 'ornament'] },
  '角色与鸟群':     { systems: ['object', 'scene'], lines: ['animals', 'navigation', 'combat', 'projectiles'], keywords: ['bird', 'flock', 'unit', 'soldier', 'courier', 'fox', 'tiger', 'crane', 'los', 'nav', 'foot', 'crowd', 'impostor'] },
  '苔庭与植被':     { systems: ['scene', 'object'], lines: ['plants', 'wind', 'shadows'], keywords: ['pine', 'tree', 'canopy', 'moss', 'flower', 'grass', 'leaf', 'shrub', 'wind', 'impostor', 'billboard'] },
  '湖沼与生物':     { systems: ['scene', 'object'], lines: ['water-effects', 'animals', 'shore', 'smoke'], keywords: ['swamp', 'water', 'splash', 'ripple', 'foam', 'fish', 'whale', 'butterfly', 'firefly', 'fog', 'mist', 'snow'] },
});

/** 快速重构前诊断：为什么不直接把 REACode 原版代码搬进游戏管线 */
export function diagnoseRawReacodeRisks(entry) {
  const src = String(entry.source || '');
  const unmatched = entry.unmatchedExports || [];
  const risks = [];
  if (src.endsWith('.html')) risks.push('单页原型混写 DOM/相机/动画循环，无法在 Worker 离线执行');
  if (entry.status === 'missing-target') risks.push('重构库尚无物理落点，缺少统一模块边界与单元测试');
  else if (unmatched.length > 0) risks.push(`有 ${unmatched.length} 个原版导出尚未对齐到重构库，接口语义未校验`);
  if (/three|render|pass|material|shader|light|shadow|outline|reflect|fog|snow|splash|bird|flag/i.test(src + ' ' + unmatched.join(' '))) {
    risks.push('直接耦合渲染状态或时间步，缺少 reads/writes/preserves 契约与确定性种子');
  } else {
    risks.push('缺少能力契约（保护带/净空声明）与独立验证 Worker 检查项');
  }
  return risks;
}

/** 根据文件名与导出推断最受益的目标系统（确定性先验，供 JEV 研判复核） */
export function inferCandidateTarget(entry) {
  const text = (String(entry.source || '') + ' ' + (entry.unmatchedExports || entry.originalExports || []).join(' ')).toLowerCase();
  if (/sphere|planet|globe|geodesic|icosa|orbit|equator/.test(text)) return 'planet';
  if (/cage|meshcheck|impostor|props|holepair|wallframe|deform|billboard|bird|butterfl|flag|unit/.test(text)) return 'object';
  if (/lightvol|backlit|surfaceshadow|vertexlight|outline|reflection|megatex|ornament|surface/.test(text)) return 'multi';
  return 'scene';
}

/** 生成「快速重构与能力引入」四步蓝图（替代慢速手工全量迁移） */
export function buildFastTrackBlueprint(entry, targetSystem) {
  const base = String(entry.source || '').replace(/^.*\//, '').replace(/\.(js|mjs|html)$/, '');
  const unmatched = (entry.unmatchedExports || entry.originalExports || []).slice(0, 6);
  const targetDir = targetSystem === 'planet' ? 'core' : targetSystem === 'object' ? 'build' : /light|shadow|reflect|outline|backlit|surface/i.test(base) ? 'light' : /water|shore|splash|river|wave/i.test(base) ? 'water' : /bird|butterfl|flag|snow|fog|canopy/i.test(base) ? 'life' : 'terrain';
  const refPath = (entry.targets && entry.targets[0]) || `townscaper-web/REACodeRefactoring/src/${targetDir}/${base}.js`;
  const workshopLayer = targetSystem === 'planet' ? 'planet' : targetSystem === 'object' ? 'object' : /light|shadow|reflect|backlit|bird|butterfl|snow|fog/i.test(base) ? 'lightlife' : /nav|los|path|traffic/i.test(base) ? 'battle' : /roof|wall|house|prop|cage/i.test(base) ? 'building' : 'relief';
  const effort = entry.status === 'missing-target' ? (unmatched.length >= 4 ? 'M' : 'S') : (unmatched.length <= 2 ? 'S' : 'M');

  return {
    effort,
    effortLabel: effort === 'S' ? '快捷（~15分钟内核抽取）' : '中等（~30分钟契约重构）',
    targetModule: refPath,
    workshopLayer,
    targetSystem,
    exportsToPort: unmatched,
    steps: [
      `1. 纯核抽取：从 REACode/${entry.source} 剥离 DOM/全局状态，将 ${unmatched.slice(0, 3).join(', ') || base} 迁入 ${refPath}`,
      `2. 声明契约：补充 reads / writes / preserves 保护带契约与固定种子确定性`,
      `3. 挂载管线：在 src/system-workshop/${workshopLayer}/capabilities.js 注册可执行 ⚙ 能力与参数滑块`,
      `4. 行为裁判：在 ${workshopLayer}/verify.js 接入独立数值核验 + 同种子原版对账（L4→L5）`,
    ],
    agentPrompt: `请按快速重构协议将 REACode/${entry.source} 的核心算法（${unmatched.slice(0, 4).join(', ') || base}）抽取重构到 ${refPath}，修复原版耦合瑕疵并补充单测；随后封装为 src/system-workshop/${workshopLayer}/capabilities.js 的可执行 ⚙ 能力（带契约 reads/writes/preserves 与独立 verify），不直接复制原版未重构代码。`,
  };
}

/** 汇总游戏资产表大类 × 三大系统覆盖矩阵 */
export function buildAssetCoverageMatrix({ inventory, maturityRows = [], jevCategoryDecisions = {} }) {
  const groups = new Map();
  for (const s of inventory?.sources || []) {
    const cat = s.category || '未分类';
    if (!groups.has(cat)) groups.set(cat, { category: cat, assets: [], geometries: new Set(), reviewed: 0 });
    const g = groups.get(cat);
    g.assets.push({ id: s.id, path: s.canonicalSource || s.originalSource, exports: (s.exports || []).slice(0, 4) });
    for (const geo of s.geometry || []) g.geometries.add(geo);
    if (/reviewed/i.test(s.reading || '')) g.reviewed++;
  }

  const rows = [];
  for (const [cat, g] of groups) {
    const rule = ASSET_CATEGORY_RULES[cat] || { systems: ['scene'], lines: [], keywords: [] };
    const matchedCaps = maturityRows.filter((r) => rule.lines.includes(r.line));
    const highMaturity = matchedCaps.filter((r) => (r.level || 0) >= 6).length;
    const assetCount = g.assets.length;
    // 缺口压力 = 资产数量占比 × (1 - 高成熟度能力覆盖度)
    const coverageRatio = Math.min(1, matchedCaps.length / Math.max(4, Math.ceil(assetCount * 0.45)));
    const gapScore = Math.round((assetCount * (1.25 - coverageRatio * 0.75)) * 10) / 10;
    const jev = jevCategoryDecisions[cat] || null;
    rows.push({
      category: cat,
      assetCount,
      reviewedCount: g.reviewed,
      sampleAssets: g.assets.slice(0, 5).map((a) => a.id.replace(/^assets__/, '')),
      geometries: [...g.geometries].slice(0, 6),
      systems: rule.systems,
      lines: rule.lines,
      executableCount: matchedCaps.length,
      highMaturityCount: highMaturity,
      coveragePct: Math.round(coverageRatio * 100),
      gapScore,
      strategy: jev?.choice || (coverageRatio < 0.55 ? 'refactor-reacode' : 'wrap-existing-refactored'),
      jevConfidence: jev?.confidence ?? null,
      jevAccepted: jev?.accepted ?? false,
    });
  }
  return rows.sort((a, b) => b.gapScore - a.gapScore);
}

/** 综合资产表 + REACode 候选 + JEV 研判，生成完整「智能体能力雷达」JSON */
export function buildAssetCapabilityRadar({ inventory, alignment = [], maturityRows = [], jevDiscovery = null, jevCategories = null, topN = 28 }) {
  const catDecisions = jevCategories?.decisions || {};
  const assetMatrix = buildAssetCoverageMatrix({ inventory, maturityRows, jevCategoryDecisions: catDecisions });

  const discDecisions = jevDiscovery?.decisions || {};
  const jsCandidates = alignment.filter((a) => /\.(js|mjs)$/.test(a.source || '') && (a.status === 'missing-target' || (a.unmatchedExports || []).length > 0));

  const scored = [];
  for (const a of jsCandidates) {
    const text = (String(a.source || '') + ' ' + (a.unmatchedExports || a.originalExports || []).join(' ')).toLowerCase();
    // 匹配哪些资产表大类会直接受益
    const matchedCategories = [];
    let assetLeverage = 0;
    for (const row of assetMatrix) {
      const rule = ASSET_CATEGORY_RULES[row.category];
      if (!rule) continue;
      const hits = rule.keywords.filter((kw) => text.includes(kw));
      if (hits.length) {
        matchedCategories.push({ category: row.category, assetCount: row.assetCount, hits });
        assetLeverage += hits.length * (1 + Math.log2(1 + row.assetCount));
      }
    }
    const jev = discDecisions[a.source] || null;
    const heuristicTarget = inferCandidateTarget(a);
    const targetSystem = (jev && jev.accepted && jev.choice !== 'skip' && SYSTEM_META[jev.choice]) ? jev.choice : heuristicTarget;
    if (jev && jev.accepted && jev.choice === 'skip') continue;

    const unmatchedCount = (a.unmatchedExports || []).length;
    const isMissingTarget = a.status === 'missing-target';
    const jevBoost = jev ? (jev.accepted ? 3.5 * jev.confidence : 1.2 * jev.confidence) : 0;
    const readiness = unmatchedCount <= 4 ? 1.25 : 1.0;
    const priorityScore = Math.round(((assetLeverage * 1.4 + Math.min(8, unmatchedCount) * 0.9 + (isMissingTarget ? 2.2 : 1.0) + jevBoost) * readiness) * 10) / 10;

    scored.push({
      id: a.source,
      source: a.source,
      status: a.status,
      unmatchedCount,
      unmatchedExports: (a.unmatchedExports || a.originalExports || []).slice(0, 8),
      existingTargets: (a.targets || []).slice(0, 3),
      targetSystem,
      targetSystemName: SYSTEM_META[targetSystem]?.name || targetSystem,
      heuristicSystem: heuristicTarget,
      matchedCategories: matchedCategories.slice(0, 3),
      benefitingAssets: matchedCategories.reduce((sum, m) => sum + m.assetCount, 0),
      priorityScore,
      jev: jev ? { choice: jev.choice, confidence: jev.confidence, accepted: jev.accepted, cached: !!jev.cached } : null,
      rawRisks: diagnoseRawReacodeRisks(a),
      blueprint: buildFastTrackBlueprint(a, targetSystem),
    });
  }

  scored.sort((a, b) => b.priorityScore - a.priorityScore || a.source.localeCompare(b.source));
  const discoveries = scored.slice(0, topN);

  const bySystem = { planet: 0, scene: 0, object: 0, multi: 0 };
  for (const d of discoveries) if (bySystem[d.targetSystem] !== undefined) bySystem[d.targetSystem]++;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    rubric: {
      name: '三段式资产驱动能力研判（确定性资产映射 → JEV 低成本初筛 → 快速契约重构）',
      formula: 'Priority = (AssetLeverage × 1.4 + UnmatchedExports × 0.9 + Novelty + JEVBoost) × RefactorReadiness',
      principles: [
        '拒绝照搬 REACode 原型代码：所有发现必须经过「纯核抽取 → 契约封装 → 管线挂载 → 行为对账」四步快速重构。',
        '以游戏真实资产表（95 项资产源）驱动补学优先级，而不是被动按发帖时间排队。',
        '批量分类与初筛交由 JEV（单项缓存），开发模型只复核低置信度条目与编写核心重构代码。',
      ],
    },
    summary: {
      totalAssets: (inventory?.sources || []).length,
      assetCategories: assetMatrix.length,
      reacodeCandidatesScanned: jsCandidates.length,
      recommendedDiscoveries: discoveries.length,
      bySystem,
      jevDiscoveryAnswered: jevDiscovery?.usage?.answered || 0,
      jevDiscoveryAccepted: Object.values(discDecisions).filter((v) => v.accepted).length,
      jevCategoryAnswered: jevCategories?.usage?.answered || 0,
      jevCostUsd: Number(((jevDiscovery?.usage?.cost_usd || 0) + (jevCategories?.usage?.cost_usd || 0)).toFixed(6)),
      jevCacheHits: (jevDiscovery?.usage?.cache_hits || 0) + (jevCategories?.usage?.cache_hits || 0),
      jevRequests: (jevDiscovery?.usage?.requests || 0) + (jevCategories?.usage?.requests || 0),
    },
    assetMatrix,
    discoveries,
  };
}
