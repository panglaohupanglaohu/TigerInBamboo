// =====================================================================
//  小地图 · 经典场景标注（页面左上角，任务面板下方）
//
//  - 等距方位投影（azimuthal equidistant）：以全部地标的平均方向为图心，
//    整个游玩半球（小岛北极 → 南半球峡谷）完整收入一张圆盘图
//  - 经典场景彩点 + 中文标注；橙色楔形 = 送信人实时位置与朝向
//  - 菜单列表：点击场景名/图上圆点 → 脉冲高亮 + toast 报距离
//  - 可折叠为圆形按钮；2D Canvas 绘制，SwiftShader/CI 零 WebGL 负担
// =====================================================================
import * as THREE from "three";
import { makePanelDraggable } from "./dragPanel.js";

const _v = new THREE.Vector3();
const _n = new THREE.Vector3(); // 相机处地表法线
const _f = new THREE.Vector3(); // 切平面视野前向

/** 垂直 FOV（度）+ 宽高比 → 水平半张角（rad），供测试复用 */
export function hFovHalfRad(fovDeg = 60, aspect = 1.6) {
  return Math.atan(Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2) * Math.max(aspect, 1e-3));
}

/**
 * 等距方位投影：单位方向 → 圆盘平面坐标（供测试复用的纯函数）。
 * @param {THREE.Vector3} dir    目标方向（无需归一化）
 * @param {THREE.Vector3} center 图心方向（单位）
 * @param {THREE.Vector3} right  图心切平面右轴（单位）
 * @param {THREE.Vector3} up     图心切平面上轴（单位）
 * @param {number} maxRho        圆盘边缘对应的最大角距（rad）
 * @param {number} radius        圆盘像素半径
 * @returns {{x:number,y:number,rho:number,clamped:boolean}}
 */
export function azimuthalProject(dir, center, right, up, maxRho, radius) {
  _v.copy(dir).normalize();
  const cos = THREE.MathUtils.clamp(_v.dot(center), -1, 1);
  const rho = Math.acos(cos);
  const px = _v.x - center.x * cos;
  const py = _v.y - center.y * cos;
  const pz = _v.z - center.z * cos;
  const len = Math.hypot(px, py, pz);
  let sx = 0;
  let sy = 0;
  if (len > 1e-9) {
    sx = (px * right.x + py * right.y + pz * right.z) / len;
    sy = (px * up.x + py * up.y + pz * up.z) / len;
  }
  const rr = Math.min(rho / maxRho, 1) * radius;
  return { x: sx * rr, y: -sy * rr, rho, clamped: rho > maxRho };
}

/**
 * @param {{
 *   landmarks: Array<{ id:string, name:string, color:string,
 *     getDir: () => THREE.Vector3|null|undefined }>,
 *   getVisible?: () => Array<object>,
 *   getPlayer: () => { position: THREE.Vector3, facing?: THREE.Vector3 }|null,
 *   getView?: () => { position: THREE.Vector3, forward: THREE.Vector3,
 *     fov?: number, aspect?: number }|null,   // 相机视野（视野扇形框）
 *   planetRadius?: number,
 *   rangeRad?: number,   // 圆盘边缘对应的角距（rad），默认 0.5 ≈ 80 世界单位
 *   toast?: (msg:string, dur?:number) => void,
 * }} opts
 *   - landmarks：全集（兜底用）。
 *   - getVisible：**三级导航**用。返回当前该显示的子集（Planet / Region / Local），
 *     由 `world/worldStructure.js` 的 `visibleLandmarks()` 算出。
 *     不传则退回 `landmarks` 全集，保持旧调用方兼容。
 *     图例会在可见 id 集合变化时重建——所以进出区域时列表会跟着增减。
 */
export function createMinimap({ landmarks, getVisible = null, getPlayer, getView = null, planetRadius = 160, rangeRad = 0.5, toast = () => {} }) {
  const questPanel = document.getElementById("quest-panel");
  const hud = document.getElementById("hud");
  if (!questPanel || !hud) return null;

  // ---------- DOM：与任务面板组成左上角竖排栈 ----------
  const stack = document.createElement("div");
  stack.id = "topleft-stack";
  questPanel.parentNode.insertBefore(stack, questPanel);
  stack.appendChild(questPanel);

  const panel = document.createElement("div");
  panel.id = "minimap-panel";
  panel.innerHTML = `
    <div class="mm-head" id="minimap-head" title="按住拖动，把小地图移到任意位置">
      <strong>小地图 · 经典场景</strong>
      <button type="button" id="minimap-collapse" aria-expanded="true" title="收起/展开小地图">▾</button>
    </div>
    <div id="minimap-body">
      <canvas id="minimap-canvas" width="190" height="190" aria-label="星球小地图"></canvas>
      <ul id="minimap-legend"></ul>
    </div>
  `;
  stack.appendChild(panel);

  const canvas = panel.querySelector("#minimap-canvas");
  const ctx = canvas.getContext("2d");
  const legend = panel.querySelector("#minimap-legend");
  const W = canvas.width;
  const H = canvas.height;
  const CX = W / 2;
  const CY = H / 2;
  const DISC_R = W / 2 - 8;

  // ---------- 折叠 ----------
  const collapseBtn = panel.querySelector("#minimap-collapse");
  collapseBtn.addEventListener("click", () => {
    const collapsed = panel.classList.toggle("collapsed");
    collapseBtn.textContent = collapsed ? "🗺" : "▾";
    collapseBtn.setAttribute("aria-expanded", String(!collapsed));
  });

  // ---------- 拖拽摆放（标题栏按住拖动，位置持久化） ----------
  // 默认在左上角竖排栈的文档流里；首次拖拽时脱流切 position:fixed，
  // 有历史存档则创建即恢复固定位置。
  const POS_KEY = "tm.minimap.pos.v1";
  const head = panel.querySelector("#minimap-head");
  const detachFromStack = (e) => {
    // 点在折叠按钮等控件上不脱流（沿用通用拖拽的控件豁免口径）
    const t = e?.target;
    if (t && typeof t.closest === "function" && t.closest("button")) return;
    if (panel.style.position !== "fixed") {
      panel.style.position = "fixed";
      panel.style.zIndex = "15";
      panel.style.margin = "0";
    }
  };
  let hasSavedPos = false;
  try {
    const raw = localStorage.getItem(POS_KEY);
    const pos = raw ? JSON.parse(raw) : null;
    hasSavedPos = Number.isFinite(pos?.left) && Number.isFinite(pos?.top);
  } catch {
    /* ignore */
  }
  if (hasSavedPos) detachFromStack();
  head.addEventListener("pointerdown", detachFromStack, { capture: true });
  makePanelDraggable(panel, head, POS_KEY);

  // ---------- 可见集（三级导航）----------
  // 原来这里在**构造时**就把图例定死了；接入四级空间结构后可见集会随玩家
  // 进出区域变化（Tier0 恒显 / Tier1 进区域 / Tier2 进苔庭），
  // 所以下面所有遍历都改走 visible()，图例按 id 集合变化重建。
  let visibleCache = Array.isArray(landmarks) ? landmarks : [];
  function visible() {
    if (!getVisible) return Array.isArray(landmarks) ? landmarks : [];
    const next = getVisible();
    return Array.isArray(next) ? next : [];
  }

  // ---------- 图例菜单 ----------
  const rows = new Map();
  let legendKey = "";
  function rebuildLegend(list) {
    legend.innerHTML = "";
    rows.clear();
    for (const lm of list) {
      const li = document.createElement("li");
      li.dataset.id = lm.id;
      li.innerHTML = `<span class="dot" style="background:${lm.color}"></span>
        <span class="nm">${lm.name}</span><span class="dist">—</span>`;
      li.addEventListener("click", () => ping(lm.id, true));
      legend.appendChild(li);
      rows.set(lm.id, li);
    }
  }
  /** 只在可见 id 集合真的变了才重建 DOM（每帧重建会把点击态和滚动位置抖掉） */
  function syncLegend(list) {
    const key = list.map((lm) => lm.id).join("|");
    if (key === legendKey) return;
    legendKey = key;
    rebuildLegend(list);
  }
  syncLegend(visibleCache);

  // ---------- 投影基架（以送信人为图心 · 固定比例尺 · 每帧重建） ----------
  // 旧方案以「全部地标平均方向」为图心：峡谷远景把 maxRho 撑到 1.5+ rad，
  // 主岛场景被压成一团不可读。改为以玩家为图心 + 固定比例尺 rangeRad：
  // 近处场景（岛屿）清晰铺开；远处场景（峡谷/水晶城）截断到圆盘边缘减淡，
  // 作为方向指示（clamped 路径已有）。
  const center = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const maxRho = rangeRad;
  function computeBasis() {
    const player = getPlayer?.();
    let okFlag = false;
    if (player?.position && player.position.lengthSq() > 1e-8) {
      center.copy(player.position).normalize();
      okFlag = true;
    } else {
      for (const lm of visibleCache) {
        const d = lm.getDir?.();
        if (d && d.lengthSq() > 1e-8) {
          center.copy(d).normalize();
          okFlag = true;
          break;
        }
      }
    }
    if (!okFlag) return false;
    // 图上方向 = 图心处的纬线递增方向（世界 +Y 的切平面投影）
    up.set(0, 1, 0).addScaledVector(center, -center.y);
    if (up.lengthSq() < 1e-6) up.set(0, 0, 1).addScaledVector(center, -center.z);
    up.normalize();
    right.crossVectors(up, center).normalize();
    return true;
  }
  // 兼容旧引用（下方绘制/点击统一走 computeBasis）
  function ensureBasis() {
    return computeBasis();
  }

  // ---------- 脉冲高亮 ----------
  const pings = new Map(); // id → 截止时间（performance.now ms）
  function ping(id, report = false) {
    pings.set(id, performance.now() + 1600);
    if (report) {
      // 点击来自图例/图上，一律在全集里找——可见集刚变化时也能报出名字
      const lm = (Array.isArray(landmarks) ? landmarks : []).find((l) => l.id === id)
        ?? visibleCache.find((l) => l.id === id);
      const player = getPlayer?.();
      const d = lm?.getDir?.();
      if (lm && player && d) {
        const dist =
          Math.acos(
            THREE.MathUtils.clamp(
              _v.copy(d).normalize().dot(player.position.clone().normalize()),
              -1,
              1
            )
          ) * planetRadius;
        toast(`${lm.name} · 直线距离约 ${dist.toFixed(0)}`, 2.2);
      } else if (lm) {
        toast(lm.name, 1.6);
      }
    }
  }

  // 图上点选：命中最近圆点即触发脉冲
  canvas.addEventListener("click", (ev) => {
    if (!ensureBasis()) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ((ev.clientX - rect.left) / rect.width) * W - CX;
    const my = ((ev.clientY - rect.top) / rect.height) * H - CY;
    let best = null;
    let bestD = 14; // 命中半径 px
    // 只命中当前画出来的点：画不出来的点不该能被点到
    for (const lm of visibleCache) {
      const d = lm.getDir?.();
      if (!d || d.lengthSq() < 1e-8) continue;
      const p = azimuthalProject(d, center, right, up, maxRho, DISC_R);
      const dd = Math.hypot(p.x - mx, p.y - my);
      if (dd < bestD) {
        bestD = dd;
        best = lm;
      }
    }
    if (best) ping(best.id, true);
  });

  // ---------- 绘制 ----------
  let lastDraw = 0;
  let lastDist = 0;
  function draw(now) {
    // 每帧刷一次可见集：玩家可能刚跨进/离开某区域或苔庭
    visibleCache = visible();
    syncLegend(visibleCache);
    ctx.clearRect(0, 0, W, H);
    // 纸面圆盘
    const bg = ctx.createRadialGradient(CX, CY, 8, CX, CY, DISC_R + 6);
    // 与旧 HUD 深色玻璃主题一致；深色纸面能让白色地标文字和高亮更稳定可读。
    bg.addColorStop(0, "#315e68");
    bg.addColorStop(0.8, "#214956");
    bg.addColorStop(1, "#122d3c");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(CX, CY, DISC_R + 4, 0, Math.PI * 2);
    ctx.fill();
    // 距离场环 + 十字方位线
    ctx.strokeStyle = "rgba(158, 197, 255, 0.22)";
    ctx.lineWidth = 1;
    for (const k of [1 / 3, 2 / 3, 1]) {
      ctx.beginPath();
      ctx.arc(CX, CY, DISC_R * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(CX - DISC_R, CY);
    ctx.lineTo(CX + DISC_R, CY);
    ctx.moveTo(CX, CY - DISC_R);
    ctx.lineTo(CX, CY + DISC_R);
    ctx.stroke();

    // 相机视野扇形框：顶点 = 相机图位，张角 = 真实水平 FOV，铺在地标之下
    const view = getView?.();
    if (view?.position && view?.forward && view.position.lengthSq() > 1e-8) {
      _n.copy(view.position).normalize();
      _f.copy(view.forward).addScaledVector(_n, -_n.dot(view.forward));
      if (_f.lengthSq() > 1e-8) {
        _f.normalize();
        const vp = azimuthalProject(view.position, center, right, up, maxRho, DISC_R);
        // 图上朝向角：沿切向前向探一小步，取投影差分方向
        _v.copy(_n).addScaledVector(_f, 0.05).normalize();
        const vf = azimuthalProject(_v, center, right, up, maxRho, DISC_R);
        const ang = Math.atan2(vf.y - vp.y, vf.x - vp.x);
        const half = hFovHalfRad(view.fov ?? 60, view.aspect ?? 1.6);
        const ax = CX + vp.x;
        const ay = CY + vp.y;
        const LEN = DISC_R * 0.34; // 定长示意（方位指示，非测距）
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.arc(ax, ay, LEN, ang - half, ang + half);
        ctx.closePath();
        ctx.fillStyle = "rgba(110, 210, 205, 0.22)";
        ctx.fill();
        ctx.strokeStyle = "rgba(158, 225, 255, 0.72)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // 地标（只画当前可见级：Tier0 恒显 / Tier1 进区域 / Tier2 进苔庭）
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const lm of visibleCache) {
      const d = lm.getDir?.();
      if (!d || d.lengthSq() < 1e-8) continue;
      const p = azimuthalProject(d, center, right, up, maxRho, DISC_R);
      const x = CX + p.x;
      const y = CY + p.y;
      ctx.globalAlpha = p.clamped ? 0.35 : 1;
      // 脉冲圈
      const until = pings.get(lm.id);
      if (until && until > now) {
        const k = 1 - (until - now) / 1600; // 0→1
        ctx.strokeStyle = lm.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.beginPath();
        ctx.arc(x, y, 6 + k * 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = p.clamped ? 0.35 : 1;
      }
      ctx.fillStyle = lm.color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = "rgba(232, 238, 248, 0.94)";
      ctx.font = "9px sans-serif";
      ctx.fillText(lm.name, x + 6, y);
      ctx.globalAlpha = 1;
    }

    // 送信人：橙色楔形（位置 + 朝向）
    const player = getPlayer?.();
    if (player?.position) {
      const p = azimuthalProject(player.position, center, right, up, maxRho, DISC_R);
      const x = CX + p.x;
      const y = CY + p.y;
      let ang = -Math.PI / 2;
      if (player.facing && player.facing.lengthSq() > 1e-8) {
        const f = azimuthalProject(
          _v.copy(player.position).normalize().addScaledVector(player.facing, 0.08),
          center,
          right,
          up,
          maxRho,
          DISC_R
        );
        ang = Math.atan2(f.y - p.y, f.x - p.x);
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = "#e8873a";
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-4.5, 4.2);
      ctx.lineTo(-2.5, 0);
      ctx.lineTo(-4.5, -4.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function update() {
    const now = performance.now();
    if (now - lastDraw < 140) return; // ~7fps 足够，2D 零负担
    lastDraw = now;
    if (!ensureBasis()) return;
    draw(now);
    // 图例距离（低频刷新）
    if (now - lastDist > 900) {
      lastDist = now;
      const player = getPlayer?.();
      for (const lm of visibleCache) {
        const row = rows.get(lm.id);
        if (!row) continue;
        const d = lm.getDir?.();
        const el = row.querySelector(".dist");
        if (!el) continue;
        if (!d || d.lengthSq() < 1e-8 || !player?.position) {
          el.textContent = "—";
          continue;
        }
        const dist =
          Math.acos(
            THREE.MathUtils.clamp(
              _v.copy(d).normalize().dot(player.position.clone().normalize()),
              -1,
              1
            )
          ) * planetRadius;
        el.textContent = dist.toFixed(0);
      }
    }
  }

  return { panel, update, ping };
}
