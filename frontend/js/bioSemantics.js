// 生物语义与「意思模块」：习性库 → 环境适生度 → 行为先验
// 任务①：接入更细的生物习性库（HABIT_ARCHETYPES），让 fitHabitat 的适生度评估更准。
export const SEMANTICS_OPTIONS = {
  niche: {
    apex: "顶级掠食", generalist: "广布杂食", grazer: "开放草食", boreal: "寒地独居",
    riparian: "溪岸亲水", alpine: "高山攀岩", canopy: "林冠群飞", understory: "林下晨昏",
    nocturnal: "夜行隐栖",
  },
  diet: {
    carnivore: "肉食", herbivore: "草食", omnivore: "杂食", piscivore: "鱼食", insectivore: "虫食",
  },
  activityCycle: {
    diurnal: "昼行", nocturnal: "夜行", crepuscular: "晨昏", cathemeral: "无定",
  },
  sociality: {
    solitary: "独行", pair: "成对", herd: "群居", flock: "集群",
  },
};

// 以真实物种生态档案为参照的习性库。
// 每个原型给出：四轴语义、解剖/生态性状 traits、各环境基线亲和 env、行为先验基线 priors。
export const HABIT_ARCHETYPES = {
  apex_predator: {
    label: "顶级掠食者（虎 / 狼型）",
    niche: "apex", diet: "carnivore", activityCycle: "crepuscular", sociality: "solitary",
    traits: { thermo: 0.4, waterNeed: 0.4, cover: 0.7, climb: 0.25 },
    env: { stream: 0.7, pond: 0.35, snow: 0.85, mountain: 0.6 },
    priors: { aggression: 0.9, boldness: 0.8, activity: 0.6, social: 0.2, foraging: 0.35 },
  },
  riverine_piscivore: {
    label: "溪岸鱼食者（翠鸟 / 水獭型）",
    niche: "riparian", diet: "piscivore", activityCycle: "diurnal", sociality: "solitary",
    traits: { thermo: 0.55, waterNeed: 0.9, cover: 0.5, climb: 0.3 },
    env: { stream: 0.95, pond: 0.8, snow: 0.3, mountain: 0.3 },
    priors: { aggression: 0.7, boldness: 0.5, activity: 0.8, social: 0.25, foraging: 0.85 },
  },
  wetland_herbivore: {
    label: "湿地草食（鹿 / 兔型）",
    niche: "grazer", diet: "herbivore", activityCycle: "crepuscular", sociality: "herd",
    traits: { thermo: 0.5, waterNeed: 0.7, cover: 0.6, climb: 0.0 },
    env: { stream: 0.65, pond: 0.85, snow: 0.55, mountain: 0.4 },
    priors: { aggression: 0.15, boldness: 0.4, activity: 0.65, social: 0.85, foraging: 0.6 },
  },
  boreal_solitary: {
    label: "寒地独行（雪兔 / 狐型）",
    niche: "boreal", diet: "carnivore", activityCycle: "nocturnal", sociality: "solitary",
    traits: { thermo: 0.85, waterNeed: 0.3, cover: 0.5, climb: 0.1 },
    env: { stream: 0.5, pond: 0.35, snow: 0.95, mountain: 0.55 },
    priors: { aggression: 0.55, boldness: 0.45, activity: 0.45, social: 0.2, foraging: 0.5 },
  },
  alpine_capon: {
    label: "高山攀岩（岩羊 / 雪豹型）",
    niche: "alpine", diet: "herbivore", activityCycle: "diurnal", sociality: "herd",
    traits: { thermo: 0.7, waterNeed: 0.4, cover: 0.2, climb: 0.85 },
    env: { stream: 0.45, pond: 0.3, snow: 0.7, mountain: 0.95 },
    priors: { aggression: 0.2, boldness: 0.55, activity: 0.7, social: 0.8, foraging: 0.55 },
  },
  gregarious_avian: {
    label: "群飞鸣禽（雀 / 雁型）",
    niche: "canopy", diet: "omnivore", activityCycle: "diurnal", sociality: "flock",
    traits: { thermo: 0.4, waterNeed: 0.5, cover: 0.7, climb: 0.5 },
    env: { stream: 0.7, pond: 0.85, snow: 0.4, mountain: 0.5 },
    priors: { aggression: 0.3, boldness: 0.6, activity: 0.85, social: 0.9, foraging: 0.7 },
  },
  crepuscular_pair: {
    label: "晨昏成对（雉 / 鸽型）",
    niche: "understory", diet: "omnivore", activityCycle: "crepuscular", sociality: "pair",
    traits: { thermo: 0.45, waterNeed: 0.5, cover: 0.85, climb: 0.4 },
    env: { stream: 0.75, pond: 0.8, snow: 0.5, mountain: 0.5 },
    priors: { aggression: 0.25, boldness: 0.4, activity: 0.65, social: 0.55, foraging: 0.65 },
  },
  nocturnal_insectivore: {
    label: "夜行虫食（蝙蝠 / 鼩型）",
    niche: "nocturnal", diet: "insectivore", activityCycle: "nocturnal", sociality: "solitary",
    traits: { thermo: 0.3, waterNeed: 0.3, cover: 0.8, climb: 0.6 },
    env: { stream: 0.6, pond: 0.7, snow: 0.2, mountain: 0.4 },
    priors: { aggression: 0.35, boldness: 0.3, activity: 0.3, social: 0.25, foraging: 0.8 },
  },
  feral_omnivore: {
    label: "杂食广布（猪 / 鸦型）",
    niche: "generalist", diet: "omnivore", activityCycle: "cathemeral", sociality: "flock",
    traits: { thermo: 0.5, waterNeed: 0.5, cover: 0.4, climb: 0.3 },
    env: { stream: 0.75, pond: 0.8, snow: 0.6, mountain: 0.6 },
    priors: { aggression: 0.4, boldness: 0.7, activity: 0.7, social: 0.6, foraging: 0.7 },
  },
};

// 营养级（同组内近缘，用于食性模糊匹配）
const TROPHIC = { carnivore: 0, piscivore: 0, insectivore: 0, herbivore: 1, omnivore: 2 };
function trophicNear(a, b) { return TROPHIC[a] === TROPHIC[b]; }

/** 把四轴语义模糊解析为最贴近的习性原型（打分取最大） */
export function resolveArchetype(sem) {
  const s = sem || {};
  let best = "feral_omnivore", bestScore = -Infinity;
  for (const [id, a] of Object.entries(HABIT_ARCHETYPES)) {
    let score = 0;
    if (a.diet === s.diet) score += 2.0;
    else if (trophicNear(a.diet, s.diet || "")) score += 0.8;
    if (a.activityCycle === s.activityCycle) score += 1.0;
    if (a.sociality === s.sociality) score += 1.0;
    if (s.niche && a.niche === s.niche) score += 1.5;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return { id: best, archetype: HABIT_ARCHETYPES[best], score: bestScore };
}

// 各环境的量化工况（与 labEnv.js 保持一致）
const FIT_ENV_PROPS = {
  stream:   { temp: 0.45, water: 0.85, cover: 0.55, relief: 0.35, slick: 0.10, open: 0.45 },
  pond:     { temp: 0.70, water: 0.60, cover: 0.40, relief: 0.10, slick: 0.12, open: 0.60 },
  snow:     { temp: 0.10, water: 0.15, cover: 0.45, relief: 0.30, slick: 0.90, open: 0.75 },
  mountain: { temp: 0.25, water: 0.10, cover: 0.20, relief: 0.90, slick: 0.30, open: 0.85 },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** 原型性状 × 环境工况 → 量化适生度 0..1 */
function envSuitability(a, ep) {
  const thermal = 1 - Math.abs((a.traits.thermo ?? 0.4) - (ep.temp ?? 0.5)) * 1.1;
  const waterFit = 1 - Math.abs((a.traits.waterNeed ?? 0.4) - (ep.water ?? 0.3)) * 0.9;
  const coverFit = 1 - Math.abs((a.traits.cover ?? 0.4) - (ep.cover ?? 0.4)) * 0.6;
  const climbFit = 1 - Math.abs((a.traits.climb ?? 0.2) - (ep.relief ?? 0.3)) * 0.5;
  // 耐寒者雪面抓地更好，slip 惩罚随耐寒度下降
  const snowAdapt = a.traits.thermo ?? 0.4;
  const slipPenalty = (ep.slick ?? 0.2) * (1 - snowAdapt * 0.7);
  const s = (thermal + waterFit + coverFit + climbFit) / 4 - slipPenalty * 0.5;
  return clamp01(s);
}

/**
 * 依据语义 + 环境，产出更准的行为先验。
 * @param {Object} sem  { niche, diet, activityCycle, sociality }
 * @param {string|Object} env  环境 id 字符串，或含 { id/key, props, isSnow } 的环境对象
 */
export function fitHabitat(sem, env) {
  const envKey = (typeof env === "string")
    ? env
    : (env?.id ?? env?.key ?? "stream");
  const ep = (env && typeof env === "object" && env.props)
    ? env.props
    : (FIT_ENV_PROPS[envKey] || { temp: 0.5, water: 0.3, cover: 0.4, relief: 0.3, slick: 0.2, open: 0.5 });

  const { id: archId, archetype: a, score } = resolveArchetype(sem);
  const suitability = envSuitability(a, ep);
  const archetypeAffinity = a.env[envKey] ?? 0.5;
  // 适生度 = 原型基线亲和 与 量化工况拟合 的融合
  const affinity = clamp01(0.45 * archetypeAffinity + 0.55 * suitability);

  const p = a.priors;
  const nightPenalty = (sem?.activityCycle === "nocturnal") ? 0.6
    : (sem?.activityCycle === "crepuscular") ? 0.85 : 1.0;
  // 不适生 → 更戒备（攻击/警觉抬升）；适生 → 更大胆、更活跃
  const aggression = clamp01(p.aggression * (0.7 + 0.3 * (1 - affinity)));
  const boldness = clamp01(p.boldness * (0.6 + 0.4 * affinity));
  const activity = clamp01(p.activity * (0.5 + 0.5 * ep.temp) * nightPenalty);
  const social = clamp01(p.social * (0.8 + 0.2 * affinity));
  const waterDemand = a.traits.waterNeed ?? 0.4;
  const foraging = clamp01(p.foraging * (0.6 + 0.4 * (ep.water * waterDemand + (1 - ep.water) * (1 - waterDemand))));

  let state = "WALK";
  if (aggression > 0.7 && social < 0.4) state = "ALERT";
  else if (affinity < 0.35) state = "ALERT";
  else if (foraging > 0.75 && affinity > 0.6) state = "FORAGE";
  else if (activity < 0.35) state = "IDLE";

  return {
    aggression, boldness, activity, social, foraging, affinity, state,
    archetype: archId, archetypeLabel: a.label, suitability, matchScore: score,
  };
}

/** 把行为先验回灌记录步态（避免反复叠加漂移：先由尺寸重算基础步态，再调制） */
export function applyPriors(record, priors) {
  const st = priors.state || "WALK";
  const g = record.gait || (record.gait = {});
  const affinity = priors.affinity ?? 0.6;
  if (st === "WALK") {
    g.freq = Math.max(0.5, Math.min(2.0, g.freq || 1));
  } else if (st === "FORAGE") {
    g.freq = (g.freq || 1) * 0.7; g.spine = (g.spine || 1) * 1.2; g.tail = (g.tail || 1) * 1.1;
  } else if (st === "ALERT") {
    g.freq = (g.freq || 1) * (1.05 + (1 - affinity) * 0.2);
  } else if (st === "IDLE") {
    g.freq = Math.max(0.3, (g.freq || 1) * 0.6);
  }
  return { state: st };
}

// —— BioSemantics 类（语义记录的存取与校验） ——
export const SEMANTICS_DEFAULT = {
  niche: "generalist", diet: "omnivore",
  activityCycle: "cathemeral", sociality: "solitary",
};

export class BioSemantics {
  constructor(data = {}) { this.data = { ...SEMANTICS_DEFAULT, ...data }; }
  toJSON() { return { ...this.data }; }
  static fromJSON(json) {
    if (!json) return new BioSemantics();
    return new BioSemantics(json);
  }
  validate() {
    const d = this.data; const errors = [];
    for (const k of ["niche", "diet", "activityCycle", "sociality"]) {
      if (!SEMANTICS_OPTIONS[k] || !(d[k] in SEMANTICS_OPTIONS[k])) errors.push(`未知 ${k}：${d[k]}`);
    }
    return { valid: errors.length === 0, errors };
  }
}

export const SEMANTICS_LABELS = SEMANTICS_OPTIONS;
