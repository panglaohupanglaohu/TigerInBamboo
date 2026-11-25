/**
 * layer-focus.js — R21 直达入口（纯逻辑，Node 测试与浏览器共用）。
 * 战役 / 山形 / 表现层原来都塞在「场景管线」页最下面，只在特定场景出现、面板 176 px 高。
 * 现在它们在系统工坊顶部各有一个页签：点它 → 仍是场景层（tier=scene），但页面只显示这一块并撑到能看清的高度；
 * 当前场景跑不了这一层时，自动切到能跑的场景（切场景只是换镜头和面板，不改任何场景数据）。
 */
export const FOCUS_LAYERS = Object.freeze({
  battle: Object.freeze({ title: '战役管线', pane: 'battle-workshop', scenes: Object.freeze(['apostles', 'moss', 'citadel', 'bookshop']), prefer: 'apostles' }),
  mountain: Object.freeze({ title: '山形管线', pane: 'mountain-workshop', scenes: Object.freeze(['citadel']), prefer: 'citadel' }),
  fx: Object.freeze({ title: '表现层管线', pane: 'fx-workshop', scenes: Object.freeze(['apostles', 'moss', 'citadel', 'bookshop']), prefer: 'apostles' }),
});
const TIERS = ['planet', 'scene', 'object'];
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

/** 页签名 / 地址栏 hash → { tier, focus }。未知名字一律回到场景层。 */
export function resolveTab(name) {
  if (own(FOCUS_LAYERS, name)) return { tier: 'scene', focus: name };
  if (TIERS.includes(name)) return { tier: name, focus: null };
  return { tier: 'scene', focus: null };
}

/**
 * 要直达某一层时该切到哪个场景。
 * @returns null = 不用切（当前场景就能跑，或不是直达层）；string = 要切到的场景 id；undefined = 场景列表里没有能跑这一层的场景
 */
export function sceneForFocus(focus, current, available) {
  if (!own(FOCUS_LAYERS, focus)) return null;
  const f = FOCUS_LAYERS[focus];
  if (f.scenes.includes(current)) return null;
  if (!available || available.includes(f.prefer)) return f.prefer;
  return f.scenes.find((s) => available.includes(s));
}
