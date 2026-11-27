// R3 清爽主题引擎：不逐个改旧样式，而是读取页面上每一张同源样式表，把「深底浅字」的中性色
// 按亮度翻转成「浅底深字」，保留色相（琥珀 / 薄荷 / 警示红仍是同一色系），生成 html[data-theme=light] 覆盖层。
// 新加载的样式表（子工坊按需注入的 css）会自动补算。默认清爽浅色，可一键切回深邃暗色。
const KEY = 'tm.theme.v1';
const STYLE_ID = 'tm-light-derived';
const PREFIX = 'html[data-theme="light"]';
const COLOR_PROPS = ['background-color', 'color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'fill', 'stroke', 'caret-color'];

export function parseColor(text) {
  if (!text) return null;
  const t = text.trim().toLowerCase();
  let m = t.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  m = t.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4] };
  return null;
}
function toHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
const fmt = ({ h, s, l }, a) => `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(Math.max(0, Math.min(1, l)) * 100).toFixed(1)}%${a < 1 ? ' / ' + a.toFixed(3) : ''})`;

// 亮度翻转：深色表面 → 瓷白；浅色文字 → 墨色；中等饱和的强调色只做轻微压暗，保证在浅底上可读
export function lightenFor(prop, text) {
  const c = parseColor(text);
  if (!c) return null;
  const hsl = toHsl(c), isText = prop === 'color' || prop === 'fill' || prop === 'caret-color';
  const isBorder = prop.startsWith('border') || prop === 'outline-color' || prop === 'stroke';
  if (isText) {
    if (hsl.l < 0.45) return null;
    // 浅字 → 深字；带颜色的提示字（琥珀 / 绿 / 红）保留色相并加饱和
    return fmt({ h: hsl.h, s: hsl.s < 0.12 ? Math.min(hsl.s, 0.14) : Math.min(1, hsl.s * 1.05 + 0.1), l: hsl.s < 0.12 ? 0.98 - hsl.l * 0.86 : Math.min(0.42, 1.08 - hsl.l * 0.95) }, c.a);
  }
  if (isBorder) {
    if (hsl.l > 0.55) return null;
    return fmt({ h: hsl.h || 160, s: Math.min(hsl.s, 0.22), l: 0.9 - hsl.l * 0.28 }, c.a);
  }
  // 背景：深色表面翻成浅色层次（越深的面板翻得越白，保留层级差）
  if (hsl.l > 0.45) return null;
  const sat = hsl.s < 0.3 ? Math.min(hsl.s * 0.7, 0.18) : Math.min(hsl.s, 0.5);
  return fmt({ h: hsl.h || 160, s: sat, l: 0.985 - hsl.l * 0.42 }, c.a < 1 ? Math.min(1, c.a + 0.05) : 1);
}

function rewriteSelector(sel) {
  return sel.split(',').map((part) => {
    const p = part.trim();
    if (!p) return null;
    if (/^(html|:root)\b/.test(p)) return null;
    return `${PREFIX} ${p}`;
  }).filter(Boolean).join(',');
}

function deriveRules(rules, out) {
  for (const rule of rules) {
    if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE) {
      const inner = [];
      deriveRules(rule.cssRules, inner);
      if (inner.length) out.push(`${rule.type === CSSRule.MEDIA_RULE ? '@media ' + rule.conditionText : '@supports ' + rule.conditionText}{${inner.join('')}}`);
      continue;
    }
    if (rule.type !== CSSRule.STYLE_RULE || !rule.selectorText) continue;
    const decl = [];
    for (const prop of COLOR_PROPS) {
      const v = rule.style.getPropertyValue(prop);
      if (!v || v.includes('var(')) continue;
      const next = lightenFor(prop, v);
      if (next) decl.push(`${prop}:${next}${rule.style.getPropertyPriority(prop) ? '!important' : ''}`);
    }
    const bg = rule.style.getPropertyValue('background-image');
    if (bg && bg.includes('gradient') && !bg.includes('var(')) {
      const swapped = bg.replace(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi, (m) => lightenFor('background-color', m) || m);
      if (swapped !== bg) decl.push(`background-image:${swapped}`);
    }
    if (!decl.length) continue;
    const sel = rewriteSelector(rule.selectorText);
    if (sel) out.push(`${sel}{${decl.join(';')}}`);
  }
}

const derived = new WeakSet();
let chunks = [];
function rebuild() {
  for (const sheet of document.styleSheets) {
    const owner = sheet.ownerNode;
    if (derived.has(sheet) || owner?.id === STYLE_ID || owner?.dataset?.themeSkip != null) continue;
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    derived.add(sheet);
    const out = [];
    deriveRules(rules, out);
    if (out.length) chunks.push(`/* ${owner?.href || owner?.id || 'inline'} */\n` + out.join('\n'));
  }
  let tag = document.getElementById(STYLE_ID);
  if (!tag) {
    tag = document.createElement('style');
    tag.id = STYLE_ID;
    tag.dataset.themeSkip = '';
    const refresh = document.querySelector('link[href*="studio-refresh.css"]');
    refresh ? refresh.before(tag) : document.head.append(tag);
  }
  tag.textContent = chunks.join('\n');
}

export function currentTheme() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch {}
  const b = document.getElementById('theme-toggle');
  if (b) { b.textContent = theme === 'light' ? '☾ 深邃暗色' : '☀ 清爽浅色'; b.setAttribute('aria-pressed', String(theme === 'light')); b.title = '切换界面主题（当前：' + (theme === 'light' ? '清爽浅色' : '深邃暗色') + '）'; }
  window.dispatchEvent(new CustomEvent('tm-theme', { detail: theme }));
}

export function mountTheme() {
  let saved = 'light';
  try { saved = localStorage.getItem(KEY) || 'light'; } catch {}
  rebuild();
  setTheme(saved === 'dark' ? 'dark' : 'light');
  const b = document.getElementById('theme-toggle');
  if (b) b.onclick = () => setTheme(currentTheme() === 'light' ? 'dark' : 'light');
  // 子工坊按需注入的样式表：加载完成后补算
  new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) {
      if (n.nodeName === 'LINK' && n.rel === 'stylesheet') n.addEventListener('load', rebuild, { once: true });
      else if (n.nodeName === 'STYLE' && n.id !== STYLE_ID) queueMicrotask(rebuild);
    }
  }).observe(document.head, { childList: true });
  window.addEventListener('load', rebuild, { once: true });
  window.tmTheme = { set: setTheme, get: currentTheme, rebuild };
}

if (typeof document !== 'undefined' && !globalThis.__tmThemeNoAuto) mountTheme();
