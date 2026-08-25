// =====================================================================
//  开发者菜单：右上角 🤖；滑杆调参 + FPS；改动写入 localStorage
// =====================================================================
import { P, P_DEFAULTS, FEATURES, saveParams, resetParams } from "./params.js";
import { makePanelDraggable } from "../ui/dragPanel.js";
import { LIGHTING_DEBUG_VIEW_MODES, LIGHTING_DEBUG_VIEW_DEFAULT } from "../render/lighting/debugViewMode.js";
import { LIGHTING_QUALITY_TIERS } from "../render/lighting/lightingQuality.js";

const SLIDERS = [
  { key: "moveSpeed", label: "移动速度", min: 1, max: 15, step: 0.1, group: "玩家" },
  { key: "sprintMult", label: "疾跑倍率", min: 1, max: 2.5, step: 0.05, group: "玩家" },
  { key: "gravity", label: "引力强度", min: 5, max: 40, step: 0.5, group: "玩家" },
  { key: "jumpV", label: "跳跃速度", min: 3, max: 15, step: 0.1, group: "玩家" },
  { key: "camLerp", label: "跟随平滑", min: 1, max: 15, step: 0.1, group: "相机" },
  { key: "upLerp", label: "Up 翻转平滑", min: 0.5, max: 10, step: 0.1, group: "相机" },
  { key: "camDist", label: "相机距离", min: 5, max: 28, step: 0.5, group: "相机" },
  { key: "talkRange", label: "对话距离", min: 2, max: 10, step: 0.5, group: "交互" },
  { key: "tramSpeed", label: "电车速度", min: 0, max: 10, step: 0.2, group: "交通" },
  { key: "aircraftSpeed", label: "飞船速度", min: 0.5, max: 20, step: 0.1, group: "交通" },
  { key: "aircraftScale", label: "飞船体积倍", min: 1, max: 12, step: 1, group: "交通" },
  { key: "aircraftHoldSec", label: "飞船停留秒", min: 0, max: 60, step: 5, group: "交通" },
  { key: "windSpeed", label: "风速", min: 0, max: 4, step: 0.1, group: "交通" },
  { key: "windDir", label: "风向", min: 0, max: 360, step: 5, group: "交通" },
  { key: "daySpeed", label: "昼夜速度", min: 0, max: 2, step: 0.05, group: "天空" },
  { key: "timeOfDay", label: "时刻", min: 0, max: 1, step: 0.01, group: "天空" },
  { key: "weather", label: "天气 0晴1雨2雪", min: 0, max: 2, step: 1, group: "天空" },
];

/**
 * @param {object} deps
 * @param {import("three").DirectionalLight} deps.sun
 * @param {import("three").AmbientLight} deps.ambient
 * @param {(d: number) => void} [deps.onCamDist]
 * @param {() => void} [deps.onOpenMap] 打开地图编辑器
 * @param {() => void} [deps.onOpenCitadel] 打开古堡 Townscaper / WFC 搭建器
 * @param {() => void} [deps.onOpenStoryboard] 打开并列的故事板工作台
 * @param {() => string} [deps.onGateHere] 把三重门/云墙搬到玩家当前轨道位置，返回状态文字
 * @param {() => string} [deps.onGateReset] 恢复三重门/云墙的默认位置，返回状态文字
 * @param {() => string} [deps.onLakeHere] 把白鲸湖搬到玩家当前位置，返回状态文字
 * @param {() => string} [deps.onLakeReset] 恢复白鲸湖的默认位置，返回状态文字
 * @param {() => void} [deps.onOpenShotHarness] 打开运行时截图 / OskSta A-B 工作台
 * @param {boolean} [deps.cloudWallEnabled] 城头云墙当前是否显示
 * @param {(on: boolean) => string} [deps.onCloudWallToggle] 开关城头云墙，返回状态文字
 */
export function createDevPanel({
  sun,
  ambient,
  lightingDirector = null, // V5 光照导演：开启时滑杆写入 trim 而非直接碰灯
  lightingV5 = false,
  voxelAo = null, // K3/K7：体素 AO 系统（可传对象或 () => 对象的惰性取值；null=不提供）
  localLights = null, // K4/K7：局部灯预算桥接（同 voxelAo 支持惰性取值）
  onCamDist,
  onOpenMap,
  onOpenCitadel,
  onOpenStoryboard,
  onGateHere,
  onGateReset,
  onLakeHere,
  onLakeReset,
  onOpenShotHarness,
  cloudWallEnabled = false,
  onCloudWallToggle,
}) {
  // 应用已持久化的光照
  if (Number.isFinite(P.sunIntensity)) sun.intensity = P.sunIntensity;
  if (Number.isFinite(P.ambientIntensity)) ambient.intensity = P.ambientIntensity;
  if (lightingV5 && lightingDirector) {
    // V5：旧默认 1.6/1.4 是旧管线量纲，换算成 trim 乘子作用于主题值
    lightingDirector.setTrims({
      sunMul: P.sunIntensity / 1.6,
      ambientMul: P.ambientIntensity / 1.4,
    });
  }
  if (onCamDist) onCamDist(P.camDist);

  const toggle = document.createElement("button");
  toggle.id = "dev-toggle";
  toggle.type = "button";
  toggle.title = "开发者菜单";
  toggle.textContent = "🤖";
  document.body.appendChild(toggle);

  const panel = document.createElement("div");
  panel.id = "dev-panel";
  panel.style.display = "none";
  document.body.appendChild(panel);

  let html = `<div class="dev-head" id="dev-drag-handle" title="拖动摆放面板"><strong>开发者菜单</strong><span class="dev-fps" id="dev-fps">-- fps</span></div>`;
  html += `<div class="dev-hint">拖标题栏可摆放 · 参数自动保存到本机</div>`;
  let lastGroup = "";
  for (const s of SLIDERS) {
    if (s.group !== lastGroup) {
      html += `<div class="dev-group">${s.group}</div>`;
      lastGroup = s.group;
    }
    html +=
      `<label class="dev-row"><span>${s.label}</span>` +
      `<input type="range" data-key="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${P[s.key]}">` +
      `<em data-val="${s.key}">${P[s.key]}</em></label>`;
  }
  html += `<div class="dev-group">光照</div>`;
  html +=
    `<label class="dev-row"><span>太阳光强</span>` +
    `<input type="range" data-light="sun" min="0" max="3" step="0.05" value="${sun.intensity}">` +
    `<em data-lval="sun">${sun.intensity.toFixed(2)}</em></label>`;
  html +=
    `<label class="dev-row"><span>环境光强</span>` +
    // 修正：上限原为 1 与默认 1.4 不一致，统一 0~3
    `<input type="range" data-light="ambient" min="0" max="3" step="0.02" value="${ambient.intensity}">` +
    `<em data-lval="ambient">${ambient.intensity.toFixed(2)}</em></label>`;
  // ---------- V5 光照 · K7（TODO 572/573） ----------
  // voxelAo/localLights 在面板之后装配（main.js 初始化顺序），支持惰性取值；
  // 构建期调用可能撞上 let 的 TDZ，安全回退 null
  const safeGet = (fn) => { try { return fn(); } catch { return null; } };
  const getVoxelAo = () => (typeof voxelAo === "function" ? safeGet(voxelAo) : voxelAo);
  const getLocalLights = () => (typeof localLights === "function" ? safeGet(localLights) : localLights);
  if (lightingDirector) {
    html += `<div class="dev-group">V5 光照 · K7</div>`;
    html +=
      `<label class="dev-row dev-check"><span>V5 管线（关=legacy）</span>` +
      `<input type="checkbox" id="dev-v5-enabled" ${lightingV5 ? "checked" : ""}></label>`;
    html +=
      `<label class="dev-row dev-check"><span>冻结光照状态</span>` +
      `<input type="checkbox" id="dev-v5-freeze"></label>`;
    html +=
      `<label class="dev-row"><span>质量分档</span>` +
      `<select id="dev-v5-quality">` +
      Object.keys(LIGHTING_QUALITY_TIERS)
        .map((q) => `<option value="${q}" ${FEATURES.lightingQuality === q ? "selected" : ""}>${q}</option>`)
        .join("") +
      `</select></label>`;
    html +=
      `<label class="dev-row"><span>调试视图</span>` +
      `<select id="dev-v5-debug-view">` +
      [LIGHTING_DEBUG_VIEW_DEFAULT, ...LIGHTING_DEBUG_VIEW_MODES.filter((m) => m !== LIGHTING_DEBUG_VIEW_DEFAULT)]
        .map((m) => `<option value="${m}">${m}</option>`)
        .join("") +
      `</select></label>`;
    html +=
      `<label class="dev-row"><span>阴影预设</span>` +
      `<select id="dev-v5-shadow-preset"><option value="paper">paper</option><option value="soft">soft</option></select></label>`;
    html +=
      `<label class="dev-row dev-check"><span>体素 AO</span>` +
      `<input type="checkbox" id="dev-v5-ao" ${voxelAo ? "" : "disabled"}></label>`;
    html +=
      `<label class="dev-row dev-check"><span>单次色彩反弹（high 档+刷新）</span>` +
      `<input type="checkbox" id="dev-v5-bounce" ${FEATURES.voxelBounceV1 ? "checked" : ""}></label>`;
    html +=
      `<label class="dev-row"><span>曝光</span>` +
      `<input type="range" id="dev-v5-exposure" min="0.2" max="3" step="0.05" value="1">` +
      `<em id="dev-v5-exposure-val">1.00</em></label>`;
    html +=
      `<label class="dev-row"><span>天空/地面光</span>` +
      `<input type="range" id="dev-v5-sky" min="0" max="3" step="0.05" value="1">` +
      `<em id="dev-v5-sky-val">1.00</em></label>`;
    if (localLights) {
      const cap = getLocalLights()?.getDebugInfo?.().budget ?? 8;
      html +=
        `<label class="dev-row"><span>局部灯预算</span>` +
        `<input type="range" id="dev-v5-light-budget" min="0" max="${cap}" step="1" value="${cap}">` +
        `<em id="dev-v5-light-budget-val">${cap}</em></label>`;
    }
    html += `<p class="dev-hint">bounce 采样侧尚未接入着色器，开关只写 FEATURES 标志；调试视图的真实 shader 通道分解属浏览器 GPU 阶段</p>`;
  }
  html += `<div class="dev-group">地图 / 故事板</div>`;
  html += `<button type="button" id="dev-open-map" class="dev-action">🗺️ 打开地图编辑</button>`;
  html += `<button type="button" id="dev-open-citadel" class="dev-action">🏰 打开古堡搭建</button>`;
  html += `<button type="button" id="dev-open-storyboard" class="dev-action">🎬 打开故事板工作台</button>`;
  html += `<button type="button" id="dev-open-shot-harness" class="dev-action">📸 打开 OskSta A/B 工作台</button>`;
  html += `<p class="dev-hint">故事板已独立为并列面板（左上 🎬），支持分镜拖拽与 LLM 执行</p>`;
  // ---------- 三重门 / 云墙 ----------
  html += `<div class="dev-group">三重门 · 云墙</div>`;
  html +=
    `<label class="dev-row dev-check"><span>城头云墙（搁置）</span>` +
    `<input type="checkbox" id="dev-cloud-wall" ${cloudWallEnabled ? "checked" : ""}>` +
    `<em id="dev-cloud-wall-em">${cloudWallEnabled ? "显示中" : "已关闭"}</em></label>`;
  html += `<p class="dev-hint">云墙设计未定稿：默认不进场景；勾选才生成在城头</p>`;
  html += `<button type="button" id="dev-gate-here" class="dev-action">📍 搬到我当前位置</button>`;
  html += `<button type="button" id="dev-gate-reset" class="dev-action">↩︎ 恢复默认（入谷口）</button>`;
  html += `<p class="dev-hint" id="dev-gate-status">站到想要的位置再点；位置存本机，刷新后保留</p>`;
  html += `<div class="dev-group">白鲸湖（搬离水晶城可提性能）</div>`;
  html += `<button type="button" id="dev-lake-here" class="dev-action">📍 湖搬到我当前位置</button>`;
  html += `<button type="button" id="dev-lake-reset" class="dev-action">↩︎ 湖恢复默认（花厅塔下）</button>`;
  html += `<p class="dev-hint" id="dev-lake-status">湖含 283 个可绘制对象（面数比水晶城还多），搬远可减少同屏负担</p>`;
  html += `<button type="button" id="dev-reset">重置全部参数</button>`;
  panel.innerHTML = html;

  // 标题栏拖拽摆放（位置记入 localStorage）
  makePanelDraggable(
    panel,
    panel.querySelector("#dev-drag-handle"),
    "tm.ui.devPanel.pos"
  );

  toggle.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });

  const mapBtn = panel.querySelector("#dev-open-map");
  if (mapBtn && onOpenMap) {
    mapBtn.addEventListener("click", () => {
      onOpenMap();
      panel.style.display = "none";
    });
  }
  const citadelBtn = panel.querySelector("#dev-open-citadel");
  if (citadelBtn && onOpenCitadel) {
    citadelBtn.addEventListener("click", () => {
      onOpenCitadel();
      panel.style.display = "none";
    });
  }
  const sbBtn = panel.querySelector("#dev-open-storyboard");
  if (sbBtn && onOpenStoryboard) {
    sbBtn.addEventListener("click", () => {
      onOpenStoryboard();
      panel.style.display = "none";
    });
  }
  const shotBtn = panel.querySelector("#dev-open-shot-harness");
  if (shotBtn && onOpenShotHarness) {
    shotBtn.addEventListener("click", () => {
      onOpenShotHarness();
      panel.style.display = "none";
    });
  }

  // ---------- 三重门 / 云墙 开关 + 定位 ----------
  {
    const gateStatus = panel.querySelector("#dev-gate-status");
    const setStatus = (msg) => {
      if (gateStatus && msg) gateStatus.textContent = msg;
    };
    const cloudCb = panel.querySelector("#dev-cloud-wall");
    const cloudEm = panel.querySelector("#dev-cloud-wall-em");
    cloudCb?.addEventListener("change", () => {
      if (!onCloudWallToggle) return;
      try {
        const msg = onCloudWallToggle(!!cloudCb.checked);
        if (cloudEm) cloudEm.textContent = cloudCb.checked ? "显示中" : "已关闭";
        setStatus(msg || (cloudCb.checked ? "云墙已开" : "云墙已关"));
      } catch (e) {
        setStatus(`云墙开关失败：${e.message}`);
        cloudCb.checked = !cloudCb.checked;
      }
    });
    panel.querySelector("#dev-gate-here")?.addEventListener("click", () => {
      if (!onGateHere) return;
      try {
        setStatus(onGateHere() || "已搬到当前位置");
      } catch (e) {
        setStatus(`失败：${e.message}`);
      }
    });
    panel.querySelector("#dev-gate-reset")?.addEventListener("click", () => {
      if (!onGateReset) return;
      try {
        setStatus(onGateReset() || "已恢复默认位置");
      } catch (e) {
        setStatus(`失败：${e.message}`);
      }
    });

    const lakeStatus = panel.querySelector("#dev-lake-status");
    const setLake = (msg) => {
      if (lakeStatus && msg) lakeStatus.textContent = msg;
    };
    panel.querySelector("#dev-lake-here")?.addEventListener("click", () => {
      if (!onLakeHere) return;
      try {
        setLake(onLakeHere() || "湖已搬到当前位置");
      } catch (e) {
        setLake(`失败：${e.message}`);
      }
    });
    panel.querySelector("#dev-lake-reset")?.addEventListener("click", () => {
      if (!onLakeReset) return;
      try {
        setLake(onLakeReset() || "湖已恢复默认位置");
      } catch (e) {
        setLake(`失败：${e.message}`);
      }
    });
  }

  // ---------- V5 光照 · K7 控件绑定 ----------
  if (lightingDirector) {
    const bindCheck = (id, fn) => panel.querySelector(id)?.addEventListener("change", (e) => fn(e.target.checked));
    const bindSelect = (id, fn) => panel.querySelector(id)?.addEventListener("change", (e) => fn(e.target.value));
    const bindRange = (id, valId, fn) => panel.querySelector(id)?.addEventListener("input", (e) => {
      const v = Number(e.target.value);
      const em = panel.querySelector(valId);
      if (em) em.textContent = v.toFixed(2);
      fn(v);
    });
    bindCheck("#dev-v5-enabled", (on) => lightingDirector.setEnabled(on));
    bindCheck("#dev-v5-freeze", (on) => lightingDirector.setFrozen(on));
    bindSelect("#dev-v5-quality", (q) => { FEATURES.lightingQuality = q; });
    bindSelect("#dev-v5-debug-view", (m) => lightingDirector.setDebugViewMode(m));
    bindSelect("#dev-v5-shadow-preset", (p) => lightingDirector.setShadowPreset(p));
    bindCheck("#dev-v5-ao", (on) => getVoxelAo()?.setEnabled(on));
    bindCheck("#dev-v5-bounce", (on) => { FEATURES.voxelBounceV1 = on; });
    bindRange("#dev-v5-exposure", "#dev-v5-exposure-val", (v) => lightingDirector.setTrims({ exposureMul: v }));
    bindRange("#dev-v5-sky", "#dev-v5-sky-val", (v) => lightingDirector.setTrims({ skyMul: v }));
    bindRange("#dev-v5-light-budget", "#dev-v5-light-budget-val", (v) => getLocalLights()?.setBudgetCap(v));
  }

  panel.addEventListener("input", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.dataset.key) {
      const k = t.dataset.key;
      P[k] = Number(t.value);
      panel.querySelector(`[data-val="${k}"]`).textContent = t.value;
      if (k === "camDist" && onCamDist) onCamDist(P.camDist);
      saveParams();
    } else if (t.dataset.light) {
      const isSun = t.dataset.light === "sun";
      const value = Number(t.value);
      panel.querySelector(`[data-lval="${t.dataset.light}"]`).textContent = value.toFixed(2);
      if (isSun) P.sunIntensity = value;
      else P.ambientIntensity = value;
      if (lightingV5 && lightingDirector) {
        // V5：写入 LightingState trim，不直接碰 Three Light（且旧灯已被导演隐藏）
        lightingDirector.setTrims(
          isSun ? { sunMul: value / 1.6 } : { ambientMul: value / 1.4 }
        );
      } else {
        const light = isSun ? sun : ambient;
        light.intensity = value;
      }
      saveParams();
    }
  });

  panel.querySelector("#dev-reset").addEventListener("click", () => {
    resetParams();
    if (lightingV5 && lightingDirector) {
      lightingDirector.setTrims({
        sunMul: P.sunIntensity / 1.6,
        ambientMul: P.ambientIntensity / 1.4,
      });
    } else {
      sun.intensity = P.sunIntensity;
      ambient.intensity = P.ambientIntensity;
    }
    for (const s of SLIDERS) {
      const input = panel.querySelector(`[data-key="${s.key}"]`);
      input.value = String(P[s.key]);
      panel.querySelector(`[data-val="${s.key}"]`).textContent = String(P[s.key]);
    }
    panel.querySelector('[data-light="sun"]').value = String(P.sunIntensity);
    panel.querySelector('[data-lval="sun"]').textContent = String(P.sunIntensity);
    panel.querySelector('[data-light="ambient"]').value = String(P.ambientIntensity);
    panel.querySelector('[data-lval="ambient"]').textContent = String(P.ambientIntensity);
    if (onCamDist) onCamDist(P.camDist);
  });

  const elFps = panel.querySelector("#dev-fps");
  let frames = 0;
  let accum = 0;
  return {
    tick(dt) {
      frames += 1;
      accum += dt;
      if (accum >= 0.5) {
        elFps.textContent = `${(frames / accum).toFixed(0)} fps`;
        frames = 0;
        accum = 0;
      }
    },
  };
}
