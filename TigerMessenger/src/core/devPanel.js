// =====================================================================
//  开发者菜单：右上角 🤖；滑杆调参 + FPS；改动写入 localStorage
// =====================================================================
import { P, P_DEFAULTS, saveParams, resetParams } from "./params.js";

const SLIDERS = [
  { key: "moveSpeed", label: "移动速度", min: 1, max: 15, step: 0.1, group: "玩家" },
  { key: "sprintMult", label: "疾跑倍率", min: 1, max: 2.5, step: 0.05, group: "玩家" },
  { key: "gravity", label: "引力强度", min: 5, max: 40, step: 0.5, group: "玩家" },
  { key: "jumpV", label: "跳跃速度", min: 3, max: 15, step: 0.1, group: "玩家" },
  { key: "camLerp", label: "跟随平滑", min: 1, max: 15, step: 0.1, group: "相机" },
  { key: "upLerp", label: "Up 翻转平滑", min: 0.5, max: 10, step: 0.1, group: "相机" },
  { key: "camDist", label: "相机距离", min: 5, max: 28, step: 0.5, group: "相机" },
  { key: "talkRange", label: "对话距离", min: 2, max: 10, step: 0.5, group: "交互" },
];

/**
 * @param {object} deps
 * @param {import("three").DirectionalLight} deps.sun
 * @param {import("three").AmbientLight} deps.ambient
 * @param {(d: number) => void} [deps.onCamDist]
 * @param {() => void} [deps.onOpenMap] 打开地图编辑器
 */
export function createDevPanel({ sun, ambient, onCamDist, onOpenMap }) {
  // 应用已持久化的光照
  if (Number.isFinite(P.sunIntensity)) sun.intensity = P.sunIntensity;
  if (Number.isFinite(P.ambientIntensity)) ambient.intensity = P.ambientIntensity;
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

  let html = `<div class="dev-head"><strong>开发者菜单</strong><span class="dev-fps" id="dev-fps">-- fps</span></div>`;
  html += `<div class="dev-hint">参数自动保存到本机</div>`;
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
    `<input type="range" data-light="ambient" min="0" max="1" step="0.02" value="${ambient.intensity}">` +
    `<em data-lval="ambient">${ambient.intensity.toFixed(2)}</em></label>`;
  html += `<div class="dev-group">地图</div>`;
  html += `<button type="button" id="dev-open-map" class="dev-action">🗺️ 打开地图编辑</button>`;
  html += `<p class="dev-hint">选中建筑可拖动、复制、放置到平面任意位置</p>`;
  html += `<button type="button" id="dev-reset">重置全部参数</button>`;
  panel.innerHTML = html;

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
      const light = isSun ? sun : ambient;
      light.intensity = Number(t.value);
      panel.querySelector(`[data-lval="${t.dataset.light}"]`).textContent =
        Number(t.value).toFixed(2);
      if (isSun) P.sunIntensity = light.intensity;
      else P.ambientIntensity = light.intensity;
      saveParams();
    }
  });

  panel.querySelector("#dev-reset").addEventListener("click", () => {
    resetParams();
    sun.intensity = P.sunIntensity;
    ambient.intensity = P.ambientIntensity;
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
