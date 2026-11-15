/**
 * playtest-target.js — 系统工坊「游玩检验」跟随「当前场景」（2026-11-11 修复）。
 *
 * 原问题：在十二门徒（apostles）等非莫西斯湖场景里点「游玩检验」，工坊只发 play（不带场景），游戏端只把镜头还给玩家；
 * 玩家本身停在莫西斯湖附近，于是看到的是莫西斯湖。实景栏标题也写死「实景 / 莫西斯湖」。
 * 修复：play 带上当前场景 id；非莫西斯湖场景先把玩家放到该场景附近的陆地上，再回到玩家视角；标题跟当前场景名走。
 *
 * 本文件只放纯函数（不依赖 three / DOM），浏览器与 node 测试共用。
 */
export const DEFAULT_SCENE = 'morris-lake';
const SCENE_ID = /^[\w:-]{1,64}$/;

/** 工坊 → 游戏的场景 id：缺省 / 非法值回落到莫西斯湖（与「进入编辑」同一规则） */
export function playtestSceneId(id) {
  const s = String(id ?? '').trim();
  return SCENE_ID.test(s) ? s : DEFAULT_SCENE;
}

/** 场景下拉的 label（「莫西斯湖 · 湖上建筑群」）→ 实景栏用的短名（「莫西斯湖」） */
export function sceneShortName(label) {
  const s = String(label ?? '').trim();
  return s ? s.split(' · ')[0] : '莫西斯湖';
}

/** 实景栏标题：球系统看整颗星球；场景 / 物件管线跟当前场景 */
export function viewerTitle(tier, label) {
  if (tier === 'planet') return ' 实景 / 整颗星球';
  const name = sceneShortName(label);
  return tier === 'object' ? ` 实景 / ${name} · 点选物件` : ` 实景 / ${name}`;
}

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const add = (...v) => v.reduce((o, a) => ({ x: o.x + a.x, y: o.y + a.y, z: o.z + a.z }), { x: 0, y: 0, z: 0 });

/**
 * 在场景方向 dir 附近找玩家落点：由近到远逐圈采样，取第一圈里「高于水面、不在高耸岩柱顶上」且起伏最小的点。
 * groundAt(p) / waterAt(p) 返回该方向的地面 / 水面半径（与玩家物理同一套采样）。找不到返回 null。
 */
export function choosePlaytestLanding({ dir, radius = 160, groundAt, waterAt = () => -Infinity, rings = [0, 0.02, 0.05, 0.09, 0.14, 0.2, 0.27, 0.35], bearings = 12, maxRise = 12, probeLift = 40, clearance = 0.15 }) {
  const up = norm(dir);
  const ref = Math.abs(up.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const t1 = norm(cross(ref, up)), t2 = cross(up, t1);
  // 先全部采样：只保留高于水面的陆地；「岩柱顶」= 比附近最低陆地高出 maxRise 以上
  const samples = [];
  for (const a of rings) for (let k = 0; k < (a === 0 ? 1 : bearings); k++) {
    const b = (k / bearings) * Math.PI * 2;
    const d = norm(add(scale(up, Math.cos(a)), scale(t1, Math.sin(a) * Math.cos(b)), scale(t2, Math.sin(a) * Math.sin(b))));
    const probe = scale(d, radius + probeLift);
    const g = groundAt(probe), w = waterAt(probe);
    if (!Number.isFinite(g) || g <= (Number.isFinite(w) ? w : -Infinity) + 0.4) continue;
    samples.push({ d, g, rise: g - radius, angle: a, bearing: b });
  }
  if (!samples.length) return null;
  const limit = Math.min(...samples.map((s) => s.g)) + maxRise;
  for (const a of rings) {
    let best = null;
    for (const s of samples) if (s.angle === a && s.g <= limit && (!best || s.rise < best.rise)) best = s;
    if (best) {
      const position = scale(best.d, best.g + clearance);
      // 面朝场景中心（切平面内）；落在正中心时随便取一个切向
      const toward = add(up, scale(best.d, -dot(up, best.d)));
      const forward = Math.hypot(toward.x, toward.y, toward.z) > 1e-6 ? norm(toward) : t1;
      return { position, up: best.d, forward, ground: best.g, angle: best.angle, distance: best.angle * radius };
    }
  }
  return null;
}
