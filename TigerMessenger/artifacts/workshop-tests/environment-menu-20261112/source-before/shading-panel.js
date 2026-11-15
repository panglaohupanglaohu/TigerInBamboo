/**
 * shading-panel.js — 第 55 批 G1：环境面板里的「着色实验（默认关）」分组 + 八角色体角点编辑器。
 * 开关走 view.setDebug(key, on) → src/world/view-shading.js；角点编辑只改 uniform（OKLab 角点），不重烘。
 * 1710031224838771027 "author color volumes … define the whole color possibility space for each feature"：
 * 原片是在 3D 里拖角点；这里用每个角点一个取色器代替拖拽（同样是逐角点自由编辑）。
 */
import { SHADING_KEYS, FEATURE_ORDER } from '../world/view-shading.js';

const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
const CORNER_LABEL = ['低·平·干', '高·平·干', '低·陡·干', '高·陡·干', '低·平·湿', '高·平·湿', '低·陡·湿', '高·陡·湿'];

export function mountShadingPanel(view, host) {
  if (!host || !view.shading) return null;
  const wrap = document.createElement('details');
  wrap.className = 'shading-panel';
  wrap.innerHTML = `<summary>着色实验（默认关）· 第 55 批</summary>
    <div class="environment-toggles">${SHADING_KEYS.map(([k, label]) => `<label><input type="checkbox" data-shading="${k}">${label}</label>`).join('')}</div>
    <details><summary>八角色体 · 角点编辑</summary>
      <label class="environment-row">特征 <select data-cv-feature>${FEATURE_ORDER.map((f) => `<option>${f}</option>`).join('')}</select></label>
      <div class="environment-toggles" data-cv-corners></div>
    </details>
    <p class="environment-note">也可用地址参数 <code>?shade=cvolume,paintnormal</code>。开「体素场 GPU 顶点采样」会暂时关掉 CPU 顶点烘焙（避免 AO 叠两遍），关掉即恢复。</p>`;
  const footer = host.querySelector('.environment-footer');
  host.insertBefore(wrap, footer ?? null);
  const boxes = [...wrap.querySelectorAll('[data-shading]')];
  for (const b of boxes) b.onchange = () => { view.setDebug(b.dataset.shading, b.checked); window.dispatchEvent(new Event('debugsync')); };
  const sync = () => { for (const b of boxes) b.checked = !!view.shading.on[b.dataset.shading]; };
  const sel = wrap.querySelector('[data-cv-feature]'), cornersEl = wrap.querySelector('[data-cv-corners]');
  const drawCorners = () => {
    const vol = view.shading.volumes[sel.value];
    cornersEl.innerHTML = vol.rgb.map((c, i) => `<label title="角点 ${i}（u 高度 · v 坡度 · w 变化）"><input type="color" data-corner="${i}" value="${toHex(c)}">${CORNER_LABEL[i]}</label>`).join('');
    for (const inp of cornersEl.querySelectorAll('[data-corner]')) inp.oninput = () => {
      view.shading.setCorner(sel.value, +inp.dataset.corner, inp.value);
      if (!view.shading.on.cvolume) { view.setDebug('cvolume', true); sync(); }
    };
  };
  sel.onchange = drawCorners; drawCorners();
  window.addEventListener('debugsync', sync); setInterval(sync, 700); sync();
  return wrap;
}
