// 物种记录读写：物种实验室与场景页共用的存档 schema
// 优先走后端 /api/species，离线（静态托管等）回退 localStorage
export const DEFAULT_SPECIES = {
  enabled: true,
  cnName: "自定义物种",
  scientificName: "Species nova",
  anatomyType: "SALTATORIAL", // DIGITIGRADE 趾行 / UNGULIGRADE 蹄行 / SALTATORIAL 跳跃行
  // 空间生存边界盒：X 宽 / Y 总高 / Z 总长（米）
  dimensions: { width: 0.2, height: 0.3, length: 0.5 },
  // 生物学参考：肩高定四肢与躯干倾斜；尾长定独立尾管；耳长仅 SALTATORIAL 有效
  anatomicalRef: { withersHeight: 0.22, tailLength: 0.06, earLength: 0.13 },
  rendering: {
    vertexColors: false,
    baseColor: "#d3d3d3",
    roughness: 0.7,
    furLayers: 10,   // 壳层皮毛层数（0~24）
    furLength: 0.01, // 毛尖最大外延（米）
  },
  // 形体旋钮：沿体长分区倍率（臀/腹/胸/头颈）+ 腿尾管径
  shape: { rumpScale: 1, bellyScale: 1, chestScale: 1, headScale: 1, legScale: 1, tailScale: 1 },
  // 装配旋钮：颈长倍率、关节折叠倍率
  rigTuning: { neckLen: 1, legFold: 1 },
  // 驱动器：步态频率 / 摆动 / 脊椎 / 摆尾（每帧 tick 的 ctx，不重建网格）
  gait: { freq: 1, swing: 1, spine: 1, tail: 1 },
  traits: "",
  relations: [
    { target: "tiger", type: "predator-prey", drive: "fear", strength: 0.7, note: "遇虎则避" },
    { target: "stream", type: "resource", drive: "thirst", strength: 0.5, note: "临水而饮" },
  ],
  image: null, // 128px JPEG dataURL（上传图或模型截图）
};

const STORAGE_KEY = "living-classical-art-species";

const clone = (o) => JSON.parse(JSON.stringify(o));

// 深合并：override 覆盖 base，数组整体替换，未知键丢弃（与 config.js 同策略）
function merge(base, override) {
  const out = clone(base);
  if (!override || typeof override !== "object") return out;
  for (const [k, v] of Object.entries(override)) {
    if (k in out && typeof out[k] === "object" && out[k] !== null && !Array.isArray(out[k]) &&
        typeof v === "object" && v !== null && !Array.isArray(v)) {
      out[k] = merge(out[k], v);
    } else if (k in out) {
      out[k] = v;
    }
  }
  return out;
}

/** 读存档：GET /api/species → localStorage → DEFAULT_SPECIES 深拷贝（缺键由默认补齐） */
export async function loadSpecies() {
  let rec = null;
  try {
    const res = await fetch("/api/species");
    if (res.ok) {
      const data = await res.json();
      rec = data?.species ?? null;
    }
  } catch (_) { /* 离线回退 */ }
  if (!rec) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) rec = JSON.parse(raw);
    } catch (_) { /* ignore */ }
  }
  return merge(DEFAULT_SPECIES, rec);
}

/**
 * 写存档：PUT /api/species；失败写 localStorage
 * @returns {"api"|"local"|false} 实际写入通道（false = 全部失败）
 */
export async function saveSpecies(record) {
  try {
    const res = await fetch("/api/species", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (res.ok) return "api";
  } catch (_) { /* 离线回退 */ }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    return "local";
  } catch (_) {
    return false;
  }
}
