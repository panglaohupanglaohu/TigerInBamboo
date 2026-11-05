import { applyBadNorthTheme, BN_PAL } from '../badnorth/theme.js';

/** Discoverable controls for the current shared View; experiments remain separate. */
export function mountEnvironmentPanel(view, { getScene }) {
  const host = document.getElementById('environment-panel');
  if (!host) return;
  const toggles = [['wind', '风场箭头'], ['snow', '飘雪与表面积雪'], ['fog', '岛周薄雾'], ['clouds', '流动云层'], ['moody', '远景阴云'], ['flags', '迎风旗帜'], ['waves', '岸浪'], ['waterfalls', '瀑布'], ['birds', '海鸥']];
  host.insertAdjacentHTML('beforeend', `<div class="environment-body">
    <p class="environment-note">场景可用 · 控制当前岛屿，无需跳转实验页</p>
    <div class="environment-toggles">${toggles.map(([key, label]) => `<label><input type="checkbox" data-environment="${key}">${label}</label>`).join('')}</div>
    <label class="environment-row">风向 <input id="environment-direction" type="range" min="0" max="360" step="5" aria-label="风向角度"><output id="environment-angle"></output></label>
    <label class="environment-row">光照时段 <select id="environment-time"><option value="day">白天</option><option value="dusk">黄昏</option><option value="night">夜晚</option><option value="bn" disabled>北境主题光照</option></select></label>
    <label class="environment-row" id="environment-theme-row">北境环境配色 <select id="environment-theme">${Object.entries(BN_PAL).map(([key,p])=>`<option value="${key}">${p.name}</option>`).join('')}</select></label>
    <p class="environment-note">雪为粒子与表面着色；雨天仅北境配色，尚无降雨模拟。风场箭头用于观察绕障气流。</p>
    <details><summary>雾参数 · 当前场景</summary>
      <label class="environment-row">雾浓度 <input id="environment-fog-opacity" type="range" min="0" max="1" step=".05" aria-label="雾浓度"><output id="environment-fog-opacity-value"></output></label>
      <label class="environment-row">雾流速 <input id="environment-fog-speed" type="range" min="0" max="2" step=".1" aria-label="雾流速"><output id="environment-fog-speed-value"></output></label>
    </details>
    <details><summary>更多能力实验 · 单独验收</summary><div class="environment-links">
      <a href="clouds.html">远景阴云对照</a><a href="flow.html">洞内风场诊断</a><a href="wake-fog.html">船迹与背景雾</a><a href="qa-replay.html">建筑编辑压力回放</a><a href="save-mesh.html">分享存档与合并网格</a><a href="wall-palette.html">墙色编辑与过渡</a>
      <a href="palette-editor.html">地表四角色盘</a><a href="surface-shadows.html">地表阴影实验</a>
      <a href="sediment.html">沉积岩层实验</a><a href="blotches.html">地表笔触实验</a>
      <a href="garden.html">庭院围合与小径</a><a href="navigation.html">导航实验</a><a href="leaf-surface.html">叶片材质实验</a><a href="billboard-anchor.html">中心锚点卡片实验</a>
    <button type="button" data-command="replay">回放 / 停止建造</button><button type="button" data-command="exportobj">导出主体 OBJ</button></div><p class="environment-note">体素历史回放：先建造，Esc 或再次点击停止；镜头和特效不录制。OBJ 不含水、植被和特效。</p></details>
    <div class="environment-footer"><button id="environment-learning" type="button">打开完整管线与视频</button><a href="pipeline.html">管线总览 ↗</a></div>
  </div>`);
  const learn = document.getElementById('learnpanel');
  learn.classList.add('collapsed');
  const show = () => { learn.hidden = host.open; };
  host.addEventListener('toggle', show); show();
  host.querySelector('#environment-learning').onclick = () => { host.open = false; learn.hidden = false; learn.classList.remove('collapsed'); };
  for (const button of host.querySelectorAll('[data-command]')) button.onclick = () => document.getElementById(button.dataset.command).click();
  for(const [name,uniform] of [['opacity',view.atmosphere.fogOpacity],['speed',view.atmosphere.fogSpeed]]){
    const input=host.querySelector('#environment-fog-'+name),out=host.querySelector('#environment-fog-'+name+'-value');
    input.value=uniform.value;out.value=input.value;
    input.oninput=()=>{view.atmosphere.setFogAppearance({[name]:+input.value});out.value=input.value;};
  }
  const boxes = [...host.querySelectorAll('[data-environment]')];
  for (const box of boxes) box.onchange = () => { view.setDebug(box.dataset.environment, box.checked); window.dispatchEvent(new Event('debugsync')); sync(); };
  const direction = host.querySelector('#environment-direction'), angle = host.querySelector('#environment-angle');
  direction.value = Math.round((Math.atan2(view.atmosphere.uWind.value.z, view.atmosphere.uWind.value.x) * 180 / Math.PI + 360) % 360);
  angle.value = `${direction.value}°`;
  direction.oninput = () => { angle.value = `${direction.value}°`; };
  direction.onchange = () => { view.atmosphere.setWindDirection(+direction.value); };
  const time = host.querySelector('#environment-time'), theme = host.querySelector('#environment-theme');
  time.onchange = () => { if (getScene() === 'badnorth') applyBadNorthTheme(view, time.value === 'day' ? 'summer' : time.value); else view.setTimeOfDay(time.value); sync(); };
  theme.onchange = () => { if (getScene() === 'badnorth') applyBadNorthTheme(view, theme.value); sync(); };
  function sync() {
    for (const box of boxes) {
      const k = box.dataset.environment;
      const actual = { wind: view.atmosphere.arrows.visible, snow: view.atmosphere.snow.visible, fog: view.atmosphere.fog.visible, clouds: view.vegetation.cloudField?.mesh.visible, moody: view.vegetation.backdrop?.mesh.visible, flags: view.decor.flags.visible, waves: view.waves.visible, waterfalls: view.waterfalls.group.visible, birds: view.birds.visible };
      box.checked = !!(actual[k] ?? view.debugState?.[k]);
    }
    time.value = view.timeOfDay;
    host.querySelector('#environment-theme-row').hidden = getScene() !== 'badnorth';
    const selected = Object.entries(BN_PAL).find(([,p]) => p === view.bnTheme);
    if (selected) theme.value = selected[0];
  }
  window.addEventListener('debugsync', sync);
  window.addEventListener('scenechange', sync);
  // Existing keyboard shortcuts and the learning panel can change View directly.
  setInterval(sync, 500);
  sync();
}
