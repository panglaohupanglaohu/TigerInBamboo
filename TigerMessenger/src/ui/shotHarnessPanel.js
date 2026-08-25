// =====================================================================
//  运行时截图 / OskSta A-B 工作台
//  shot-harness.html 原先是独立页面；这里把它的验收能力接到真实游戏场景：
//  - 同一套 LightingDirector 切换 legacy / Oskar prototype 关键帧；
//  - 阴影焦点切换到圣城、瀑布/木马、阶梯或 Planet V9；
//  - 读取真实 renderer 统计并直接下载当前画布截图；
//  - 不复制一套 Three 场景，避免“样片通过、游戏场景没接上”的假验收。
// =====================================================================
import { P, FEATURES, resolveActiveWorldVersion } from "../core/params.js";
import { makePanelDraggable } from "./dragPanel.js";
import { setLightingPresetOverrides } from "../render/lighting/lightingState.js";
import { validateLightingPreset } from "../render/lighting/presetLoader.js";

// 工作台可选视觉 preset（TODO G16-I 后续）：色板/AO/云影/海湖反射的 versioned
// 参数包只经 setLightingPresetOverrides 注入 LightingDirector，不新建全局灯光；
// 截图只作参数来源，绝不作为运行时贴图材质。
const LIGHTING_PRESETS = Object.freeze([
  { name: "legacy-incode", label: "legacy-incode（代码内置）" },
  { name: "grok-v1", label: "grok-v1（V6-G11 关键帧包）" },
]);
const VISUAL_DATA_PACKS = Object.freeze([
  "src/render/visualV8/terrain-palette-v8.json",
  "src/render/visualV8/water-palette-v8.json",
  "src/render/visualV8/cloud-palette-v8.json",
  "src/render/visualV8/lighting-v8.json",
  "src/render/visualV8/landform-palette-v9.json",
  "src/render/visualV8/cloud-band-palette-v9.json",
]);

const PHASES = Object.freeze({
  noon: Object.freeze({ label: "正午", time: 0.5 }),
  sunset: Object.freeze({ label: "黄昏", time: 0.75 }),
  night: Object.freeze({ label: "深夜", time: 0.92 }),
});

const WORLD_VERSIONS = Object.freeze({
  v7: Object.freeze({ label: "A · V7", detail: "WFC / MC 城堡引擎" }),
  v8: Object.freeze({ label: "B · V8", detail: "球面地形与曲面水体基线" }),
  v9: Object.freeze({ label: "C · V9", detail: "Oskar 连续地貌、植被与云带" }),
});

const STYLE_ID = "shot-harness-panel-style";

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #shot-harness-panel {
      position: fixed;
      left: 16px;
      bottom: 16px;
      z-index: 34;
      display: none;
      width: min(340px, calc(100vw - 32px));
      max-height: min(72vh, 640px);
      overflow: auto;
      padding: 12px 14px 14px;
      color: #1a2638;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(47, 143, 122, 0.25);
      border-radius: 10px;
      box-shadow: 0 12px 36px rgba(26, 38, 56, 0.22);
      backdrop-filter: blur(10px);
      pointer-events: auto;
      font-size: 12px;
    }
    #shot-harness-panel.is-open { display: block; }
    #shot-harness-panel .shot-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(47, 143, 122, 0.16);
      cursor: move;
      user-select: none;
    }
    #shot-harness-panel .shot-head strong { color: #2f8f7a; letter-spacing: .04em; }
    #shot-harness-panel .shot-close {
      width: 25px;
      height: 25px;
      padding: 0;
      border: 0;
      border-radius: 7px;
      background: rgba(26, 38, 56, 0.08);
      color: #1a2638;
      cursor: pointer;
    }
    #shot-harness-panel label {
      display: grid;
      grid-template-columns: 74px 1fr;
      gap: 8px;
      align-items: center;
      margin: 6px 0;
    }
    #shot-harness-panel select,
    #shot-harness-panel button {
      min-height: 28px;
      padding: 4px 7px;
      border: 1px solid rgba(47, 143, 122, 0.28);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.78);
      color: #1a2638;
      cursor: pointer;
    }
    #shot-harness-panel button:hover { filter: brightness(1.06); }
    #shot-harness-panel .shot-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 8px;
    }
    #shot-harness-panel .shot-actions button { width: 100%; }
    #shot-harness-panel .shot-version-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin: 7px 0 4px;
    }
    #shot-harness-panel [data-world-version].is-active {
      color: white;
      background: #2f8f7a;
      border-color: #25715f;
      box-shadow: 0 0 0 2px rgba(47, 143, 122, 0.16);
    }
    #shot-harness-panel .shot-primary { background: rgba(47, 143, 122, 0.18); }
    #shot-harness-panel .shot-warn { background: rgba(233, 106, 54, 0.14); }
    #shot-harness-panel .shot-hint {
      margin: 7px 0 0;
      color: #5d6c7d;
      font-size: 10px;
      line-height: 1.45;
    }
    #shot-harness-panel .shot-stats {
      min-height: 88px;
      max-height: 190px;
      margin: 8px 0 0;
      padding: 7px;
      overflow: auto;
      white-space: pre-wrap;
      border-radius: 7px;
      background: rgba(26, 38, 56, 0.06);
      color: #405166;
      font: 10px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    @media (max-width: 700px) {
      #shot-harness-panel { left: 8px; bottom: 8px; width: min(340px, calc(100vw - 16px)); }
    }
  `;
  document.head.appendChild(style);
}

function asRoots(value) {
  const roots = typeof value === "function" ? value() : value;
  return (Array.isArray(roots) ? roots : [roots]).filter(Boolean);
}

function summarizeState({ lightingDirector, renderer, mode, phase, subject, staticTime, worldVersion }) {
  const state = lightingDirector?.getState?.() || null;
  const render = renderer?.info?.render || {};
  return {
    mode,
    phase,
    subject,
    staticTime,
    worldVersion,
    lighting: state,
    render: {
      calls: render.calls ?? 0,
      triangles: render.triangles ?? 0,
      points: render.points ?? 0,
      lines: render.lines ?? 0,
    },
  };
}

/**
 * 把 shot-harness 的 A/B 能力挂到真实运行时。
 * @param {object} deps
 * @param {object} deps.renderer
 * @param {object} deps.lightingDirector
 * @param {Record<string, object|object[]|()=>object|()=>object[]>} deps.subjects
 * @param {()=>void} [deps.onEnableOskar] 未加载 Planet V9 时的刷新回调
 */
export function createShotHarnessPanel({ renderer, lightingDirector, subjects = {}, onEnableOskar = null } = {}) {
  if (!renderer || !lightingDirector || typeof document === "undefined") return null;
  installStyle();

  const panel = document.createElement("section");
  panel.id = "shot-harness-panel";
  panel.dataset.ready = "false";
  panel.innerHTML = `
    <div class="shot-head" id="shot-harness-drag-handle">
      <strong>OskSta V7/V8/V9 · A/B/C 运行时</strong>
      <button type="button" class="shot-close" aria-label="关闭">×</button>
    </div>
    <div class="shot-version-grid" aria-label="世界管线版本 A/B/C">
      ${Object.entries(WORLD_VERSIONS).map(([version, item]) => (
        `<button type="button" data-world-version="${version}" title="${item.detail}">${item.label}</button>`
      )).join("")}
    </div>
    <p class="shot-hint" id="shot-harness-version-status">正在识别世界管线…</p>
    <label><span>验收对象</span>
      <select id="shot-harness-subject">
        <option value="citadelEnsemble">高山圣城全景</option>
        <option value="citadelCascadeAudit">第一层瀑布 / 木马</option>
        <option value="citadelStairAudit">城堡阶梯近景</option>
        <option value="planetOskarV9">Oskar 风格·球面地貌 V8/V9</option>
      </select>
    </label>
    <div class="shot-actions">
      <button type="button" id="shot-harness-build" class="shot-primary">绑定焦点</button>
      <button type="button" id="shot-harness-enable-oskar" class="shot-warn">切换到 C · V9</button>
    </div>
    <div class="shot-actions">
      <button type="button" data-shot-mode="legacy">旧光照</button>
      <button type="button" data-shot-phase="noon">实验·正午</button>
      <button type="button" data-shot-phase="sunset">实验·黄昏</button>
      <button type="button" data-shot-phase="night">实验·深夜</button>
    </div>
    <div class="shot-actions">
      <button type="button" id="shot-harness-restore">恢复昼夜</button>
      <button type="button" id="shot-harness-capture" class="shot-primary">下载当前截图</button>
    </div>
    <label><span>光照参数包</span>
      <select id="shot-harness-preset">
        ${LIGHTING_PRESETS.map((p) => `<option value="${p.name}">${p.label}</option>`).join("")}
      </select>
    </label>
    <p class="shot-hint" id="shot-harness-preset-status">参数包经 LightingDirector 注入，不新建全局灯；legacy-incode=回滚代码内置</p>
    <pre id="shot-harness-datapacks" class="shot-stats">色板数据包：未加载</pre>
    <p class="shot-hint">A/B/C 会刷新同一个主系统并原子切换完整管线；光照 A/B 仍直接作用于当前游戏画布。</p>
    <pre id="shot-harness-stats" class="shot-stats">等待绑定焦点…</pre>
  `;
  document.body.appendChild(panel);
  makePanelDraggable(panel, panel.querySelector("#shot-harness-drag-handle"), "tm.ui.shotHarness.pos");

  const subjectEl = panel.querySelector("#shot-harness-subject");
  const statsEl = panel.querySelector("#shot-harness-stats");
  const enableEl = panel.querySelector("#shot-harness-enable-oskar");
  const versionStatusEl = panel.querySelector("#shot-harness-version-status");
  let activeWorldVersion = resolveActiveWorldVersion({ search: location.search, features: FEATURES });
  let activeSubject = subjectEl.value;
  let activeMode = lightingDirector.isEnabled?.() ? "prototype" : "legacy";
  let activePhase = "noon";
  let savedRuntime = null;

  function rootsFor(id = activeSubject) {
    return asRoots(subjects[id]);
  }

  function hasPlanetRuntime() {
    return rootsFor("planetOskarV9").length > 0;
  }

  function paintWorldVersion() {
    for (const button of panel.querySelectorAll("[data-world-version]")) {
      button.classList.toggle("is-active", button.dataset.worldVersion === activeWorldVersion);
      button.setAttribute("aria-pressed", button.dataset.worldVersion === activeWorldVersion ? "true" : "false");
    }
    const item = WORLD_VERSIONS[activeWorldVersion];
    if (versionStatusEl) {
      versionStatusEl.textContent = item
        ? `当前 ${item.label} · ${item.detail}`
        : "当前为自定义开关组合；请选择 A / B / C 进入已测试版本";
    }
    panel.dataset.worldVersion = activeWorldVersion;
  }

  function switchWorldVersion(version) {
    if (!WORLD_VERSIONS[version]) return false;
    const url = new URL(location.href);
    url.searchParams.set("worldVersion", version);
    url.searchParams.set("planetPresentationVersion", version);
    url.searchParams.set("shotLab", "1");
    url.searchParams.delete("planetOskarV1");
    location.assign(url.href);
    return true;
  }

  function writeStats() {
    const payload = summarizeState({
      lightingDirector,
      renderer,
      mode: activeMode,
      phase: activePhase,
      subject: activeSubject,
      staticTime: savedRuntime ? P.timeOfDay : null,
      worldVersion: activeWorldVersion,
    });
    statsEl.textContent = JSON.stringify(payload, null, 2);
    panel.dataset.ready = "true";
    panel.dataset.mode = activeMode;
    panel.dataset.phase = activePhase;
  }

  function bindFocus() {
    activeSubject = subjectEl.value;
    const roots = rootsFor(activeSubject);
    lightingDirector.setFocus(roots);
    lightingDirector.invalidateShadowFit?.();
    if (activeSubject === "planetOskarV9" && !hasPlanetRuntime()) {
      statsEl.textContent = "V7 不加载球面运行时；请选择 B · V8 或 C · V9。";
    } else {
      writeStats();
    }
    return roots.length;
  }

  function enterStaticTime() {
    if (savedRuntime) return;
    savedRuntime = {
      daySpeed: P.daySpeed,
      timeOfDay: P.timeOfDay,
      lightingEnabled: lightingDirector.isEnabled?.() === true,
    };
    P.daySpeed = 0;
  }

  function applyPhase(phaseName) {
    const phase = PHASES[phaseName] || PHASES.noon;
    enterStaticTime();
    activeMode = "prototype";
    activePhase = phaseName;
    P.timeOfDay = phase.time;
    lightingDirector.setEnabled(true);
    lightingDirector.setFocus(rootsFor(activeSubject));
    // 先提交一次，按钮反馈无需等待下一帧；主循环随后继续维持该固定关键帧。
    lightingDirector.update(0.016, { timeOfDay: phase.time, weather: P.weather | 0 });
    writeStats();
  }

  function applyLegacy() {
    enterStaticTime();
    activeMode = "legacy";
    activePhase = "live";
    lightingDirector.setEnabled(false);
    writeStats();
  }

  function restoreRuntime() {
    if (savedRuntime) {
      P.daySpeed = savedRuntime.daySpeed;
      P.timeOfDay = savedRuntime.timeOfDay;
      lightingDirector.setEnabled(savedRuntime.lightingEnabled);
      savedRuntime = null;
    }
    activeMode = lightingDirector.isEnabled?.() ? "prototype" : "legacy";
    activePhase = "live";
    lightingDirector.invalidateShadowFit?.();
    writeStats();
  }

  function capture() {
    const canvas = renderer.domElement;
    if (!canvas?.toDataURL) return;
    const link = document.createElement("a");
    link.download = `tiger-messenger-${activeSubject}-${activeMode}-${activePhase}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  panel.querySelector(".shot-close")?.addEventListener("click", () => panel.classList.remove("is-open"));
  panel.querySelector("#shot-harness-build")?.addEventListener("click", bindFocus);
  panel.querySelector("#shot-harness-enable-oskar")?.addEventListener("click", () => {
    if (typeof onEnableOskar === "function") onEnableOskar("v9");
    else switchWorldVersion("v9");
  });
  for (const button of panel.querySelectorAll("[data-world-version]")) {
    button.addEventListener("click", () => switchWorldVersion(button.dataset.worldVersion));
  }
  subjectEl.addEventListener("change", () => {
    enableEl.disabled = activeWorldVersion === "v9";
  });
  panel.querySelector('[data-shot-mode="legacy"]')?.addEventListener("click", applyLegacy);
  for (const button of panel.querySelectorAll("[data-shot-phase]")) {
    button.addEventListener("click", () => applyPhase(button.dataset.shotPhase));
  }
  panel.querySelector("#shot-harness-restore")?.addEventListener("click", restoreRuntime);
  panel.querySelector("#shot-harness-capture")?.addEventListener("click", capture);
  enableEl.disabled = true;
  paintWorldVersion();

  // ---------- 视觉参数 preset（色板/AO/云影/海湖反射数据包） ----------
  const presetEl = panel.querySelector("#shot-harness-preset");
  const presetStatusEl = panel.querySelector("#shot-harness-preset-status");
  const dataPacksEl = panel.querySelector("#shot-harness-datapacks");
  async function applyLightingPreset(name) {
    try {
      if (name === "legacy-incode") {
        setLightingPresetOverrides(null); // 回滚：注入 null = 代码内置常量
        if (presetStatusEl) presetStatusEl.textContent = "已回滚 legacy-incode（代码内置关键帧）";
        return true;
      }
      const json = await (await fetch(`src/render/lighting/presets/${name}.json`)).json();
      const check = validateLightingPreset(json);
      if (!check.ok) throw new Error(check.errors.map((e) => `${e.path}: ${e.message}`).join("; "));
      setLightingPresetOverrides(json); // 只写 LightingState 覆盖，不新建 Three Light
      lightingDirector.invalidateShadowFit?.();
      if (presetStatusEl) presetStatusEl.textContent = `已注入 ${json.version}（回滚=legacy-incode）`;
      return true;
    } catch (err) {
      if (presetStatusEl) presetStatusEl.textContent = `参数包加载失败，保持现状：${err.message}`;
      return false;
    }
  }
  presetEl?.addEventListener("change", () => applyLightingPreset(presetEl.value));
  async function loadDataPacks() {
    const lines = [];
    for (const packPath of VISUAL_DATA_PACKS) {
      try {
        const json = await (await fetch(packPath)).json();
        const name = packPath.split("/").pop();
        const size = Object.keys(json.tokens || json.bands || json.landforms || json.conditions || {}).length;
        lines.push(`${json.version || "?"} · ${name} · ${size} 项`);
      } catch {
        lines.push(`${packPath.split("/").pop()} · 加载失败`);
      }
    }
    if (dataPacksEl) dataPacksEl.textContent = `色板数据包（只读检视，runtime 消费由 V9 flags 控制）：\n${lines.join("\n")}`;
  }
  loadDataPacks();

  const api = {
    panel,
    setOpen(open = true) {
      panel.classList.toggle("is-open", !!open);
      if (open) {
        enableEl.disabled = activeWorldVersion === "v9";
        bindFocus();
      }
      return panel.classList.contains("is-open");
    },
    bindFocus,
    setLighting(mode = "prototype", phase = "noon") {
      if (mode === "legacy") applyLegacy();
      else applyPhase(phase);
      return JSON.parse(statsEl.textContent || "{}");
    },
    restore: restoreRuntime,
    capture,
    getWorldVersion: () => activeWorldVersion,
    switchWorldVersion,
    applyLightingPreset,
    getState() {
      return summarizeState({
        lightingDirector,
        renderer,
        mode: activeMode,
        phase: activePhase,
        subject: activeSubject,
        staticTime: savedRuntime ? P.timeOfDay : null,
        worldVersion: activeWorldVersion,
      });
    },
  };
  return api;
}
