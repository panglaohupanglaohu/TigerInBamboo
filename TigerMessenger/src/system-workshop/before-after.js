/**
 * before-after.js — 管线上通用的「之前 / 之后 · 同机位对照」（R70，纯逻辑：Node 单元测试与页面共用）。
 * 任何一层的候选都能用：tier-workshop 的对照面板（before-after-panel.js）在不动镜头的前提下，
 *   ① 让这一层的 agent 切到「对照原样」（hooks.compare(on=true)）→ 拍一张游戏画面 = 之前；
 *   ② 切回候选（compare(false)）→ 同一个镜头再拍一张 = 之后；
 *   ③ 两张缩到同一尺寸逐像素比：平均差、变了的像素占比。
 * 镜头全程不动，所以两张就是同机位；要固定机位就先用这一层自己的机位按钮（例如光影与生命的正面 / 侧面 / 俯视 / 斜后）摆好再拍。
 * 只存在页面内存里（每层最多 MAX_KEEP 组），不写浏览器本地存储、不设默认；采用走管线上的通用采用环（catalog/defaults.json），本工具只给它看图的证据。
 */
export const BEFORE_AFTER_VERSION = 1;
export const MAX_KEEP = 6;
export const DIFF_SIZE = 256;
/** 两张同尺寸 RGBA 图逐像素比：mean = 平均通道差 / 255，changed = 任一通道差 > threshold 的像素占比 */
export function pixelDiff(a, b, { threshold = 12 } = {}) {
  if (!a || !b || a.length !== b.length || a.length % 4) throw new RangeError('两张图尺寸不同，没法逐像素比');
  let sum = 0, changed = 0; const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const dr = Math.abs(a[i] - b[i]), dg = Math.abs(a[i + 1] - b[i + 1]), db = Math.abs(a[i + 2] - b[i + 2]);
    sum += (dr + dg + db) / 3; if (dr > threshold || dg > threshold || db > threshold) changed++;
  }
  return { mean: n ? Math.round(sum / n / 255 * 10000) / 10000 : 0, changed: n ? Math.round(changed / n * 10000) / 10000 : 0, pixels: n };
}
/** 一组对照记录（不含图本身以外的大对象）；entries 新的在前，最多 MAX_KEEP 组。 */
export function pushEntry(entries, e) {
  const row = { at: e.at ?? Date.now(), layer: String(e.layer), scene: e.scene ?? null, candidate: e.candidate ?? null, steps: (e.steps || []).map(String), verify: e.verify ?? null, before: e.before, after: e.after, diff: e.diff ?? null, pose: e.pose ?? '当前镜头' };
  return [row, ...(entries || [])].slice(0, MAX_KEEP);
}
/** 差异一句话：完全一样时明确说「候选没有改变画面」，不说成通过。 */
export function diffSentence(d) {
  if (!d) return '还没比';
  if (d.changed === 0) return '两张完全一样：这个候选在当前镜头里没有改变画面（或对照钩子没切换）';
  return `平均像素差 ${(d.mean * 100).toFixed(2)}% · 变了的像素 ${(d.changed * 100).toFixed(1)}%`;
}
