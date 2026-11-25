/**
 * 系统工坊与学习工坊并列（顶部两个菜单）。系统工坊里：左栏能力库、上方管线区域（球系统 / 场景 / 物件三条子管线）、
 * 下方实景浏览器（一个游戏，三条管线共用，切换不重载）。
 *   球系统管线：实景切到绕星球中心的轨道镜头；场景管线：镜头回到场景；物件管线：在实景里点选物件 → 物件管线作用于它
 * 球系统 / 物件管线第一次打开才挂载（才起 Worker）。
 */
const $ = (id) => document.getElementById(id);
const TIERS = ['planet', 'scene', 'object'];
const TITLE = { planet: '球系统管线', scene: '场景管线', object: '物件管线' };
// 实景栏标题跟当前场景走（scene-picker 写 window.__tmCurrentSceneLabel）；以前写死「莫西斯湖」，十二门徒等场景也显示莫西斯湖
import { viewerTitle } from '../scene-authoring/playtest-target.js?v=playtest-r1';
// R21：战役 / 山形 / 表现层直达页签（仍属场景层，body[data-layer-focus] 决定只显示哪一块）
import { FOCUS_LAYERS, resolveTab } from './layer-focus.js?v=focus-r1';

export function mountSystemTabs({ learning, mount, request, isConnected, onConnect, onTier, onFocus, initial = location.hash.slice(1) }) {
  const tabs = { planet: $('planet-workshop-tab'), scene: $('scene-workshop-tab'), object: $('object-workshop-tab') };
  for (const id of Object.keys(FOCUS_LAYERS)) { const b = $(id + '-focus-tab'); if (b) tabs[id] = b; }   // 旧缓存的 pipeline.html 没有这三个按钮也不报错
  const openLearning = $('learning-workshop-tab').onclick, mounted = new Set();
  const cam = { yaw: 0.6, pitch: 0.35, distance: 720 };
  let tier = 'scene', focus = null;
  let camMode = null;   // 实景当前镜头：planet / scene；场景与物件之间切换不动镜头（保留点选物件后的定位）
  const applyCamera = (force = false) => {
    if (!isConnected()) return;
    const want = tier === 'planet' ? 'planet' : 'scene';
    if (want === 'scene' && camMode === 'scene' && !force) return;
    camMode = want;
    const scene = window.__tmCurrentScene || 'morris-lake';
    (want === 'planet' ? request('camera.planet', cam) : scene === 'morris-lake' ? request('open') : request('scenes.focus', { id: scene })).catch((e) => console.warn('镜头切换失败', e.message));
  };
  function set(next) {
    ({ tier, focus } = resolveTab(next));
    learning.showScene();                                   // 回到系统工坊（隐藏学习工坊）
    document.body.dataset.tier = tier;
    if (focus) document.body.dataset.layerFocus = focus; else delete document.body.dataset.layerFocus;
    $('planet-workshop').hidden = tier !== 'planet';
    $('object-workshop').hidden = tier !== 'object';
    $('scene-pane').hidden = tier !== 'scene';
    for (const id of ['save-recipe', 'export']) $(id).hidden = tier !== 'scene';
    $('planet-cam').hidden = tier !== 'planet';
    // 实景栏按钮跟着管线走：球系统里「进入编辑」= 回到整颗星球，「对照原始参数」= 对照候选与原样
    if ($('edit')) $('edit').title = tier === 'planet' ? '回到整颗星球的轨道镜头（球系统管线编辑的是整颗星球）' : '进入当前场景的编辑';
    if ($('before')) $('before').title = tier === 'planet' ? '实景在候选星球 / 海面与原样之间切换' : '对照莫西斯湖原始参数';
    $('viewer-title').textContent = viewerTitle(tier, window.__tmCurrentSceneLabel);
    for (const [k, b] of Object.entries(tabs)) b.setAttribute('aria-selected', String(k === (focus || tier)));
    history.replaceState(null, '', '#' + (focus || tier));
    document.title = '系统工坊 · ' + (focus ? FOCUS_LAYERS[focus].title : TITLE[tier]);
    if (!mounted.has(tier)) { mounted.add(tier); mount[tier]?.(); }
    applyCamera(); onTier?.(tier);
    if (focus) onFocus?.(focus);   // 每次点都确认一次场景（用户可能手动切走了）；场景已对时 onFocus 什么都不切
  }
  for (const [k, b] of Object.entries(tabs)) b.onclick = () => set(k);
  $('system-tab').onclick = () => set(focus || tier);
  $('learning-workshop-tab').onclick = () => openLearning();
  // 星球轨道镜头
  const nudge = (dy, dp, dz) => { cam.yaw += dy; cam.pitch = Math.max(-1.4, Math.min(1.4, cam.pitch + dp)); cam.distance = Math.max(240, Math.min(2000, cam.distance * dz)); applyCamera(); };
  $('cam-left').onclick = () => nudge(-0.4, 0, 1); $('cam-right').onclick = () => nudge(0.4, 0, 1);
  $('cam-in').onclick = () => nudge(0, 0, 0.8); $('cam-out').onclick = () => nudge(0, 0, 1.25);
  $('cam-up').onclick = () => nudge(0, 0.2, 1); $('cam-down').onclick = () => nudge(0, -0.2, 1);
  onConnect.push(() => { camMode = null; applyCamera(); });
  // 在实景里用鼠标转动星球后，同步镜头按钮的状态（按钮接着从当前视角转）
  window.addEventListener('message', (e) => { if (e.origin === location.origin && e.data?.type === 'tm.planet.camera') for (const k of ['yaw', 'pitch', 'distance']) if (Number.isFinite(e.data[k])) cam[k] = e.data[k]; });
  // 在实景里选中物件 → 切到物件管线，作用范围是这个物件
  window.addEventListener('message', (e) => { if (e.origin === location.origin && e.data?.type === 'tm.scene-object.selected' && e.data.row?.id) { window.__tmSelectedObject = e.data.row; if (tier !== 'object') set('object'); } });
  set(initial === 'learning' ? 'scene' : initial);
  if (initial === 'learning') openLearning();
  return {
    get tier() { return tier; }, get focus() { return focus; }, set, refreshCamera: () => applyCamera(true),
    lookAt(lon, lat) { cam.yaw = Math.atan2(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon)); cam.pitch = lat; cam.distance = Math.min(cam.distance, 520); if (tier !== 'planet') set('planet'); else applyCamera(); },
  };
}
