/**
 * apostles-compare.js — R32 十二门徒三套方案并排对照（纯逻辑：Node 单元测试与页面共用）。
 * 三套 = 认可现状 approved / 软坡 soft / 软坡 + 库地形色 soft,palette（诊断文档里可比的三档；latest 只是「仅换库」的中间对照，不作为方案）。
 * 截图来自 R29 / R30 端到端脚本写的清单 artifacts/apostles-look-views-e2e/latest.json（脚本每跑一次覆盖一次）。
 * 页面只「切换看」（游戏 iframe 带 ?apostlesLook= 重载），不设默认；采用哪套写在 docs/PENDING_USER_DECISIONS.md 等用户点头。
 */
export const MANIFEST_PATH = 'artifacts/apostles-look-views-e2e/latest.json';
export const VIEW_ORDER = ['overview', 'side', 'top', 'cliff-foot'];
export const VIEW_LABEL = { overview: '全景', side: '侧面', top: '俯视', 'cliff-foot': '崖脚特写' };
export const SCHEMES = [
  { id: 'approved', look: 'approved', name: '认可现状', desc: 'vendor 旧副本 + 十二门徒自己的石灰岩主题色。现在正常进游戏看到的就是它。' },
  { id: 'soft', look: 'soft', name: '软坡', desc: '换最新能力库 + 缓坡省 + 连续软坡顶面（?apostlesLook=soft）。诊断：在平顶 + 2 层起跳的高度场上可融台阶很少。' },
  { id: 'soft+palette', look: 'soft,palette', name: '软坡 + 库地形色', desc: '在软坡上改用能力库的地形色（草 #86a160、岩 #a7a49d），与建筑的 PALETTES.town 同一来源。' },
];
export const PENDING_TITLE = '十二门徒采用哪套';

/** APOSTLES_LOOK.id（排序后 + 连接，例如 'palette+soft'）→ 方案 id；不是三套之一的返回 null。 */
export function schemeOfLook(id) {
  const flags = new Set(String(id || 'approved').split(/[+,]/).map((s) => s.trim()).filter((s) => s && s !== 'approved'));
  if (flags.has('latest') && flags.has('soft')) flags.delete('latest');   // soft 自带 latest
  const key = ['soft', 'palette', 'latest'].filter((f) => flags.has(f)).join('+') || 'approved';
  return SCHEMES.some((s) => s.id === key) ? key : null;
}
/** 网址参数写法（'soft,palette'）→ 方案 id */
export const schemeOfParam = (param) => schemeOfLook(String(param || 'approved').replace(/,/g, '+'));

const safeFile = (f) => typeof f === 'string' && /^[\w.+-]+\.png$/.test(f);
const safeDir = (d) => typeof d === 'string' && /^artifacts\/[\w./-]+$/.test(d) && !d.includes('..');

/**
 * 清单 → 每套方案一行：四个机位的截图（缺的标「未拍」）、破面 / 植被 / 白沫检查、相对 approved 变差的项。
 * current：当前游戏里的方案 id（schemeOfLook(APOSTLES_LOOK.id)）。清单无效时 shots 全是未拍、note 说明原因。
 */
export function buildComparison(manifest, { current = null } = {}) {
  const ok = manifest && typeof manifest === 'object' && safeDir(manifest.dir) && manifest.looks && typeof manifest.looks === 'object';
  const rows = SCHEMES.map((s) => {
    const L = ok ? manifest.looks[s.id] : null;
    const shots = VIEW_ORDER.map((view) => {
      const v = (L?.views || []).find((x) => x.view === view);
      return v && safeFile(v.file) ? { view, label: VIEW_LABEL[view], src: `${manifest.dir}/${v.file}`, valid: v.valid !== false, note: v.valid === false ? '机位无效（被岩体挡住或在水下）' : '' } : { view, label: VIEW_LABEL[view], src: null, valid: false, note: '未拍' };
    });
    const surface = L?.surface || null, regressions = ok && s.id !== 'approved' ? (manifest.regressions?.[s.id] || null) : null;
    return { ...s, current: current === s.id, shots, shotCount: shots.filter((x) => x.src).length, validCount: shots.filter((x) => x.src && x.valid).length,
      surface: surface ? { status: surface.status, totals: surface.totals || null } : null, regressions, error: L?.error || null };
  });
  const note = !manifest ? '还没有对照截图：跑一次 tests/apostles-look-views-browser.mjs 后这里出现三套 × 四机位。'
    : !ok ? '截图清单格式不对，已忽略。' : `截图来自 ${manifest.dir}（${manifest.at ? new Date(manifest.at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '时间未知'}）。截图之前每套都等岩体网格连续稳定出现再拍。`;
  return { rows, views: VIEW_ORDER.map((v) => ({ view: v, label: VIEW_LABEL[v] })), current, currentKnown: current != null, note, pending: PENDING_TITLE };
}

/** 一套方案的检查一句话（页面卡片用）。 */
export function surfaceLine(row) {
  if (row.error) return '这套没拍成：' + row.error;
  const t = row.surface?.totals; if (!t) return '还没有破面 / 植被 / 白沫检查结果';
  const reg = row.regressions == null ? '' : row.regressions.length ? ` · 比认可现状变差：${row.regressions.map((r) => r.name).join('、')}` : ' · 没有比认可现状变差的项';
  return `岩体半透明材质 ${t.transparentRock} · 反面三角 ${t.inverted} · 开口边 ${t.openEdges} · 植物不贴地 ${(t.plantBadShare * 100).toFixed(1)}% · 水线无白沫 ${(t.foamUncoveredShare * 100).toFixed(1)}%${reg}`;
}
