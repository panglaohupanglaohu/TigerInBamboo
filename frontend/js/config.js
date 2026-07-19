// 配置读写：优先走后端 /api/config，离线（file:// 等）回退 localStorage
export const DEFAULT_CONFIG = {
  scene: {
    bambooCount: 90,
    mist: 0.6,
    goldBackground: true,
  },
  weather: {
    temperature: -5,     // 摄氏度：> 0 下雨，<= 0 下雪
    snowfall: 1.0,       // 降水强度
    wind: 0.3,           // 风力（吹偏雨雪、摇动竹子）
    windDirection: 0,    // 风向（度）：0=北(+Z) 90=东(+X)，风往该方向吹
  },
  tiger: {
    speed: 1.0,
    patrolRadius: 1.0,
    stripeContrast: 1.0,
    tailCurl: true,
    furLength: 1.0,      // 皮毛长度倍率（壳层纹理）
    furLayers: 12,       // 皮毛壳层数（越多越厚实，性能开销越大）
    pauseInterval: 16,   // 驻足平均间隔（秒）
    pauseDuration: 2.4,  // 驻足时长（秒）
    tailCurlDistance: 1.75, // 缠竹触发距离（米）
  },
  bamboo: {
    stiffness: 3.0,      // 回正刚度（角速度增益）
    sway: 1.0,           // 风摆幅度倍率
  },
  physics: {
    gravity: -9.82,        // 重力加速度（m/s²）
    solverIterations: 8,   // 物理求解迭代次数
  },
  pheasant: {
    enabled: true,
    count: 5,          // 锦鸡数量（0~6）
    fleeDistance: 6.0,
    returnDistance: 14.0,
    drinkInterval: 25.0,
    perchTime: 4.0,
    alertDistance: 10.0, // 警觉距离（>fleeDistance 时冻结观察）
    runDuration: 1.2,    // 拍翅奔逃时长（秒），之后惊飞
    respawnDelay: 20.0,  // 被获后重生延时（秒）
    escapeDistance: 7.0, // 惊飞逃逸距离（米）：短促抛物线
    escapeArc: 1.6,      // 逃逸抛物线弧高（米）
  },
  hunt: {                // 虎捕食（仅当背景音乐为触发曲目时开启）
    enabled: true,
    musicTrigger: "duange_xing.mp3", // 触发曲目（子串匹配）
    stalkDistance: 40.0,   // 发现猎物距离（开始潜行）
    stalkSpeed: 0.45,      // 潜行速度倍率
    sprintDistance: 20.0,  // 爆发距离（20m 起冲刺）
    sprintSpeed: 3.0,      // 冲刺速度倍率
    pounceDistance: 10.0,  // 飞扑距离（10m 起跳，落点即猎物）
    feedDuration: 6.0,     // 进食时长（秒）
    cooldown: 15.0,        // 捕食间隔（秒）
    sfxVolume: 0.8,        // 虎啸音效音量（0~1）
    catchProbability: 0.6, // 飞扑捕获概率（0~1，与猎物逃跑路线无关）
  },
  rockBamboo: {          // 大山石周边小竹：石竹相依、雪压外倾
    clusters: 5,         // 每组山石周围竹丛数
    perCluster: 8,       // 每丛小竹棵数（密集）
    snowCover: 0.9,      // 枝叶积雪覆盖率（0~1）
    lean: 14,            // 雪压外倾角（度，以山石为中心向外倾斜）
  },
  rabbit: {
    enabled: true,
    speed: 0.7,        // 蹦跳速度
    roamRadius: 6.0,   // 环游半径（米）
  },
  dialog: {
    enabled: true,
    interval: 26,          // 母女对话触发间隔（秒）
    voiceName: "auto",     // 嗓音：auto 自动选中文女声
    voiceRate: 1.0,        // 语速
    voicePitch: 1.15,      // 音高
    voiceVolume: 0.9,      // 音量 0~1
    llmEndpoint: "",       // 大模型接口：留空用内置问答脚本
    llmApiKey: "",         // 大模型 API Key
    llmModel: "",          // 大模型模型名
  },
  ecology: {
    relations: [
      { a: "tiger", b: "pheasant", type: "predator-prey", drive: "fear", strength: 0.7,
        note: "锦鸡对虎保持警戒，进入警戒距离即惊飞" },
      { a: "tiger", b: "bamboo", type: "physical", drive: "none", strength: 1.0,
        note: "虎身挤开竹竿，尾巴缠绕竹竿" },
      { a: "pheasant", b: "stream", type: "resource", drive: "thirst", strength: 0.5,
        note: "锦鸡定时到涧水边饮水" },
    ],
  },
  style: {
    inkOutline: false,
    cameraPreset: "panorama",
  },
  plum: {                // 《寒梅归雁图》场景（独立配置页 plum-config.html）
    blossomDensity: 1.0, // 梅花花量倍率
    petalCount: 220,     // 落花瓣数量
    reedClusters: 12,    // 塘岸芦苇丛数
    restGeese: 3,        // 塘边休息大雁数量
    flockGeese: 5,       // 空中归飞雁群数量（含领头雁）
    gooseScale: 2.5,     // 大雁体型倍率
    circuitTime: 38,     // 归飞盘旋时长（秒）
    circuitAlt: 13,      // 盘旋高度（米）
    groundedTime: 42,    // 游水/岸栖时长（秒）
    mist: 0.55,          // 雾气浓度 0~1
    snowfall: 0.35,      // 薄雪强度 0~2（0=无雪）
    wind: 0.25,          // 风力（梅枝轻颤、雪飘）
    windDirection: 0,    // 风向（度）：0=北(+Z) 90=东(+X)
    cameraPreset: "panorama", // 初始机位：panorama/plum/pond/flight/mountains
    rocks: {               // 梅树附近山石（独立石 A/B/C + 护根盘石挪开位）
      solo0: { x: -3.5, z: 14.1, sink: 0, tilt: 0 },
      solo1: { x: -14, z: 19.3, sink: 0.33, tilt: 30 },  // 画面最左侧
      solo2: { x: -2.8, z: 18.5, sink: 0.33, tilt: 30 }, // 梅右前方
      root: { x: -18, z: 10, sink: 0, tilt: 0 },              // 护根盘石（近根者）挪开落点
    },
    bamboo: {              // 梅下小竹
      count: 5,            // 每丛竹数
      lean: 12,            // 最大倾斜角（度，各竿随机不超过此值）
      clumps: [            // 丛位（X/Z，可增减丛数）
        { x: -14, z: 11.5 },
        { x: -4.5, z: 11 },
        { x: -10, z: 13 },
      ],
    },
  },
  bgm: {
    volume: 0.5,         // 背景音乐音量 0~1
    playlist: [          // 歌单（顺序循环）
      "/assets/audio/bgm.mp3",
      "/assets/audio/duange_xing.mp3",
    ],
  },
};

const STORAGE_KEY = "living-classical-art-config";

function merge(base, override) {
  const out = JSON.parse(JSON.stringify(base));
  if (!override || typeof override !== "object") return out;
  for (const [k, v] of Object.entries(override)) {
    if (k in out && typeof out[k] === "object" && !Array.isArray(out[k]) && typeof v === "object" && !Array.isArray(v)) {
      out[k] = merge(out[k], v);
    } else if (k in out) {
      out[k] = v;
    }
  }
  return out;
}

export async function loadConfig() {
  let cfg = null;
  try {
    const res = await fetch("/api/config");
    if (res.ok) cfg = await res.json();
  } catch (_) { /* 离线回退 */ }
  if (!cfg) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) cfg = JSON.parse(raw);
    } catch (_) { /* ignore */ }
  }
  // 迁移：旧版 scene.snowfall / scene.wind 并入 weather 栏目
  if (cfg?.scene && cfg.weather === undefined) {
    cfg.weather = {};
    if (cfg.scene.snowfall !== undefined) cfg.weather.snowfall = cfg.scene.snowfall;
    if (cfg.scene.wind !== undefined) cfg.weather.wind = cfg.scene.wind;
  }
  return merge(DEFAULT_CONFIG, cfg);
}

export async function saveConfig(config) {
  const merged = merge(DEFAULT_CONFIG, config);
  try {
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(merged),
    });
    if (res.ok) return true;
  } catch (_) { /* 离线回退 */ }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return true;
  } catch (_) {
    return false;
  }
}

export async function resetConfig() {
  try {
    await fetch("/api/config/reset", { method: "POST" });
  } catch (_) { /* ignore */ }
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}
