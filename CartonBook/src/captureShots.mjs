#!/usr/bin/env node
/**
 * captureShots.mjs — 按镜头计划在 TigerMessenger 里截屏
 * 画面只来自 Playwright screenshot / canvas.toDataURL，绝不调用文生图。
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARTON = path.resolve(__dirname, "..");
const REPO = path.resolve(CARTON, "..");
const TM = path.resolve(REPO, "TigerMessenger");

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const PRESET_DIST = {
  cover: 28,
  wide: 22,
  medium: 12,
  close: 7,
  high: 20,
};

/**
 * Strategy 2 fallback: shrink capture region if residual HUD remains.
 * Fractions of viewport (CSS px). Heavier bottom/top insets clear dock / quest stack.
 * Override via opts.cropRect = { x, y, width, height } in CSS pixels, or
 * opts.cropInset = { left, top, right, bottom } fractions 0–0.45.
 */
export const DEFAULT_CROP_INSET = {
  left: 0.04,
  top: 0.06,
  right: 0.04,
  bottom: 0.14,
};

/**
 * 解析 playwright：优先仓库 tools/shot，其次本包 node_modules，再次全局 createRequire
 */
export async function resolvePlaywright() {
  const candidates = [
    path.join(REPO, "tools/shot/node_modules/playwright/index.mjs"),
    path.join(REPO, "tools/shot/node_modules/playwright/index.js"),
    path.join(CARTON, "node_modules/playwright/index.mjs"),
    path.join(TM, "node_modules/playwright/index.mjs"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return import(pathToFileURL(c).href);
    }
  }
  try {
    const require = createRequire(path.join(REPO, "tools/shot/package.json"));
    const resolved = require.resolve("playwright");
    return import(pathToFileURL(resolved).href);
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function portOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path: "/", timeout: 800 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServer(port) {
  if (await portOpen(port)) {
    return { started: false, port, stop: async () => {} };
  }
  if (
    process.env.CARTONBOOK_NO_SPAWN_SERVER === "1" ||
    process.env.CARTONBOOK_PORT ||
    Number(port) === 8931
  ) {
    throw new Error(
      `端口 ${port} 未在听且禁止另起 python http.server（请用已运行的 8931 uvicorn）`
    );
  }
  const child = spawn(
    "python3",
    ["-m", "http.server", String(port), "--bind", "127.0.0.1"],
    { cwd: REPO, stdio: "ignore", detached: true }
  );
  child.unref();
  for (let i = 0; i < 40; i++) {
    await sleep(200);
    if (await portOpen(port)) {
      return {
        started: true,
        port,
        stop: async () => {
          try {
            process.kill(-child.pid, "SIGTERM");
          } catch {
            try {
              child.kill("SIGTERM");
            } catch {}
          }
        },
      };
    }
  }
  throw new Error(`无法在 127.0.0.1:${port} 启动静态服务器（根=${REPO}）`);
}

/** Camera family aliases (EN + 中文) → canonical id */
export const CAMERA_FAMILY_ALIASES = {
  panorama: "panorama",
  全景: "panorama",
  cinematic: "cinematic",
  镜头感: "cinematic",
  airshipPilot: "airshipPilot",
  airship: "airshipPilot",
  飞艇: "airshipPilot",
  飞艇特殊视野: "airshipPilot",
  macro: "macro",
  微距: "macro",
  tele: "tele",
  长焦: "tele",
  长焦压缩: "tele",
};

export function resolveCameraFamily(cam = {}) {
  const raw = cam.mode || cam.family || "";
  if (!raw) return null;
  const key = String(raw).trim();
  return CAMERA_FAMILY_ALIASES[key] || null;
}

/**
 * 科学镜头族默认参数（可被 shot.camera 字段覆盖）
 * 对照 docs/CAMERA-GRAMMAR.md：全景 / 镜头感 / 微距 / 长焦 / 飞艇。
 */
const FAMILY_DEFAULTS = {
  panorama: {
    dist: 34,
    pitch: 0.42,
    orbit: 0.2,
    fov: 72,
    preset: "cover",
    waitMs: 1100,
  },
  cinematic: {
    dist: 16,
    pitch: 0.04,
    orbit: 0.55,
    fov: 58,
    preset: "medium",
    waitMs: 1000,
  },
  macro: {
    dist: 4.5,
    pitch: 0.12,
    orbit: 0.08,
    fov: 46,
    preset: "close",
    waitMs: 1000,
  },
  // 长焦压缩：中远拉距 + 窄 FOV（与 macro 成对）
  tele: {
    dist: 22,
    pitch: 0.12,
    orbit: 0.85,
    fov: 40,
    preset: "wide",
    waitMs: 1000,
  },
  airshipPilot: {
    waitMs: 1400,
  },
};

function keyDownUp(page, code) {
  return page.evaluate((code) => {
    const opts = { code, key: code.replace(/^Key/, ""), bubbles: true, cancelable: true };
    document.dispatchEvent(new KeyboardEvent("keydown", opts));
    document.dispatchEvent(new KeyboardEvent("keyup", opts));
  }, code);
}

/**
 * 在页面内设置机位（零侵入，仅 evaluate）。
 * 若 shot.camera.mode / family 为 panorama|cinematic|macro|tele|airshipPilot（或中文别名），走科学镜头族。
 */
async function applyCamera(page, shot) {
  const cam = shot.camera || {};
  const family = resolveCameraFamily(cam);
  const famDef = family ? FAMILY_DEFAULTS[family] || {} : {};

  const landmark = cam.landmark || null;
  const dist =
    cam.dist ??
    famDef.dist ??
    PRESET_DIST[cam.preset || famDef.preset] ??
    12;
  const orbit = cam.orbit ?? famDef.orbit ?? 0;
  const pitch = cam.pitch ?? famDef.pitch ?? 0;
  const preset = cam.preset || famDef.preset || "medium";
  const fov = cam.fov ?? famDef.fov ?? null;
  const waitMs = cam.waitMs ?? famDef.waitMs ?? 800;

  // --- airshipPilot：先登艇再切驾驶员视角 ---
  let airshipView = null;
  if (family === "airshipPilot") {
    // 始终先开 capture-clean
    await page.evaluate(() => {
      const tm = window.__tm;
      if (typeof tm?.setCaptureMode === "function") tm.setCaptureMode(true);
      else if (globalThis.__tmUiLayers?.setCaptureMode)
        globalThis.__tmUiLayers.setCaptureMode(true);
      else document.documentElement.classList.add("tm-capture-clean");
      document.getElementById("intro")?.classList.add("hidden");
    });

    const boarded = await page.evaluate(({ landmark }) => {
      const tm = window.__tm;
      if (!tm) throw new Error("__tm 不可用");
      const ride = tm.airshipRide;
      const T = tm.THREE;
      const player = tm.player;

      // 尽量站到地标附近再召唤，便于「湖镇上空飞艇 POV」
      const resolveLandmark = (key) => {
        if (!key) return null;
        const m = tm.messenger || {};
        if (key === "morris" || key === "morrisIsland" || key === "morris-town") {
          const mi = m.morrisIsland;
          return mi?.root || mi?.group || mi || null;
        }
        const lm = m.landmarks?.[key] ?? m[key];
        if (!lm) return null;
        if (lm.isObject3D) return lm;
        if (lm.group?.isObject3D) return lm.group;
        if (lm.root?.isObject3D) return lm.root;
        return lm;
      };
      const obj = resolveLandmark(landmark);
      if (obj && player?.position) {
        tm.scene?.updateMatrixWorld?.(true);
        const target = obj.getWorldPosition
          ? obj.getWorldPosition(new T.Vector3())
          : obj.position?.clone?.() || null;
        if (target) {
          const up = target.clone().normalize();
          const side = new T.Vector3().crossVectors(up, new T.Vector3(1, 0, 0.2));
          if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
          side.normalize();
          player.position
            .copy(target)
            .addScaledVector(side, 8)
            .addScaledVector(up, 0.4);
          if (player.velocity) player.velocity.set(0, 0, 0);
        }
      }

      if (!ride) return { ok: false, reason: "no-airshipRide-api" };

      try {
        ride.summon?.();
      } catch (e) {
        return { ok: false, reason: "summon-error:" + (e.message || e) };
      }
      let board = null;
      try {
        board = ride.forceBoardForCapture?.();
      } catch (e) {
        return { ok: false, reason: "board-error:" + (e.message || e) };
      }
      if (!board?.ok) {
        return {
          ok: false,
          reason: board?.error || "forceBoardForCapture-missing",
          board,
        };
      }
      const view = ride.setViewMode?.("pilot");
      return {
        ok: true,
        state: ride.getState?.(),
        viewMode: ride.getViewMode?.() || "pilot",
        isPilot: !!ride.isPilotView?.(),
        setView: view,
        api: true,
      };
    }, { landmark });

    if (!boarded?.ok) {
      // 脆弱回退：派发 Q / F / C（文档：仅 API 缺失时）
      console.warn(
        `[capture] airshipPilot API 不足 (${boarded?.reason || "unknown"}) → KeyQ/KeyF/KeyC 回退`
      );
      await keyDownUp(page, "KeyQ");
      await sleep(400);
      await keyDownUp(page, "KeyF");
      await sleep(1900);
      await keyDownUp(page, "KeyC");
      await sleep(300);
      airshipView = {
        ok: true,
        fallback: "keydown-QFC",
        reason: boarded?.reason || null,
      };
    } else {
      airshipView = boarded;
    }

    await sleep(waitMs);
    await page.evaluate(async () => {
      const tm = window.__tm;
      // 再推几帧飞艇 update，保证 pilot 座位与可见性落地
      for (let i = 0; i < 12; i++) {
        try {
          tm?.airshipRide?.update?.(1 / 30);
        } catch {}
        if (tm?.cameraRig?.update) tm.cameraRig.update(1 / 30);
        if (tm?.renderer && tm.camera) tm.renderer.render(tm.scene, tm.camera);
        await new Promise((r) => requestAnimationFrame(r));
      }
    });
    return { cameraFamily: family, captureClean: true, airshipView };
  }

  // --- panorama / cinematic / 传统 preset ---
  const meta = await page.evaluate(
    ({ landmark, dist, orbit, pitch, preset, fov, family }) => {
      const tm = window.__tm;
      if (!tm) throw new Error("__tm 不可用");
      const T = tm.THREE;
      const player = tm.player;
      const rig = tm.cameraRig;
      const camera = tm.camera;

      // Capture-clean（策略 1）：只走 setCaptureMode，不再逐条藏面板
      if (typeof tm.setCaptureMode === "function") tm.setCaptureMode(true);
      else if (globalThis.__tmUiLayers?.setCaptureMode)
        globalThis.__tmUiLayers.setCaptureMode(true);
      else document.documentElement.classList.add("tm-capture-clean");
      const intro = document.getElementById("intro");
      if (intro) intro.classList.add("hidden");

      const resolveLandmark = (key) => {
        if (!key) return null;
        const m = tm.messenger || {};
        if (key === "morris" || key === "morrisIsland" || key === "morris-town") {
          return m.morrisIsland?.root || m.morrisIsland?.group || m.morrisIsland || null;
        }
        const lm = m.landmarks?.[key] ?? m[key];
        if (!lm) return null;
        if (lm.isObject3D) return lm;
        if (lm.group?.isObject3D) return lm.group;
        if (lm.root?.isObject3D) return lm.root;
        if (lm.mesh?.isObject3D) return lm.mesh;
        if (lm.centerDir && typeof lm.centerDir === "object") return lm;
        return lm;
      };

      let target = null;
      const lmObj = resolveLandmark(landmark);
      if (lmObj) {
        tm.scene?.updateMatrixWorld?.(true);
        if (lmObj.getWorldPosition) {
          target = lmObj.getWorldPosition(new T.Vector3());
        } else if (lmObj.position?.clone) {
          target = lmObj.position.clone();
        } else if (lmObj.centerDir?.clone) {
          const R = tm.planetRadius || tm.messenger?.R || 160;
          target = lmObj.centerDir.clone().normalize().multiplyScalar(R);
        } else if (Array.isArray(lmObj.position)) {
          target = new T.Vector3().fromArray(lmObj.position);
        }
      }

      // 镜头族：调整站位（全景更远更高；镜头感偏低贴水；微距贴前景花草）
      let standDist = preset === "close" ? 3.5 : 6.5;
      let standUp = 0.2;
      if (family === "panorama") {
        standDist = 14;
        standUp = 0.6;
      } else if (family === "cinematic") {
        standDist = 10;
        standUp = 0.05; // 贴近水面/堤线
      } else if (family === "macro") {
        standDist = 3.2; // 近景主体（花丛）塞满前幅
        standUp = 0.02; // 贴地低机位
      } else if (family === "tele") {
        standDist = 11;
        standUp = 0.25;
      }

      if (target && player?.position) {
        const up = target.clone().normalize();
        const offset = new T.Vector3(1, 0, 0.3).normalize();
        const side = new T.Vector3().crossVectors(up, offset).normalize();
        if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
        // cinematic：水上侧；macro：收侧向贴前景
        let lateral = standDist;
        if (family === "cinematic") lateral = -standDist;
        if (family === "macro") lateral = standDist * 0.55;
        const stand = target
          .clone()
          .addScaledVector(side, lateral)
          .addScaledVector(up, standUp);
        player.position.copy(stand);
        if (player.groundR != null) player.groundR = player.position.length();
        if (player.velocity) player.velocity.set(0, 0, 0);
        const look = target.clone().sub(player.position);
        look.addScaledVector(up, -look.dot(up));
        if (look.lengthSq() > 1e-6) {
          look.normalize();
          if (player.forward) player.forward.copy(look);
          if (player.facing) player.facing.copy(look);
        }
      }

      const d = Number(dist) || 12;
      if (rig?.setFirstPerson) rig.setFirstPerson(false);
      if (rig?.setDist) rig.setDist(d);
      if (fov != null && Number.isFinite(Number(fov)) && rig?.setFov) {
        rig.setFov(Number(fov));
      }
      if (rig?.orbitBy && orbit) rig.orbitBy(Number(orbit));
      if (rig?.orbitPitchBy && pitch) rig.orbitPitchBy(Number(pitch));
      if (rig?.snapToPlayer) rig.snapToPlayer();

      // panorama：强制高位俯瞰（曲地平线）
      if ((family === "panorama" || preset === "high") && camera && target) {
        const up2 = player.position.clone().normalize();
        const elev = family === "panorama" ? d * 0.85 : d * 0.65;
        const back = family === "panorama" ? d * 0.45 : d * 0.35;
        camera.position
          .copy(player.position)
          .addScaledVector(up2, elev)
          .addScaledVector(player.forward || new T.Vector3(0, 0, 1), -back);
        camera.up.copy(up2);
        camera.lookAt(target);
      }
      if (preset === "cover" && family !== "panorama" && camera && target) {
        const up2 = target.clone().normalize();
        const back = (player.forward || new T.Vector3(0, 0, 1))
          .clone()
          .multiplyScalar(-1);
        back.addScaledVector(up2, -back.dot(up2)).normalize();
        camera.position
          .copy(target)
          .addScaledVector(up2, d * 0.35)
          .addScaledVector(back, d);
        camera.up.copy(up2);
        camera.lookAt(target.clone().addScaledVector(up2, 1.2));
      }
      // cinematic：略压镜头高度，望向立面/海堤，倒影留在下半画幅
      if (family === "cinematic" && camera && target) {
        const up2 = player.position.clone().normalize();
        const fwd = (player.forward || new T.Vector3(0, 0, 1)).clone();
        fwd.addScaledVector(up2, -fwd.dot(up2));
        if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
        fwd.normalize();
        camera.position
          .copy(player.position)
          .addScaledVector(up2, Math.max(1.2, d * 0.12))
          .addScaledVector(fwd, -d * 0.92);
        camera.up.copy(up2);
        const lookAt = target.clone().addScaledVector(up2, 1.0);
        camera.lookAt(lookAt);
      }
      // macro：极低近距；前景花草/细节占画幅，中景人，远景建筑/柏树（近远分层）
      if (family === "macro" && camera && target) {
        const up2 = player.position.clone().normalize();
        const fwd = (player.forward || new T.Vector3(0, 0, 1)).clone();
        fwd.addScaledVector(up2, -fwd.dot(up2));
        if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
        fwd.normalize();
        const side = new T.Vector3().crossVectors(up2, fwd).normalize();
        // 机位几乎贴地，略偏侧，贴着前景
        camera.position
          .copy(player.position)
          .addScaledVector(up2, Math.max(0.35, d * 0.08))
          .addScaledVector(fwd, -Math.max(1.6, d * 0.85))
          .addScaledVector(side, d * 0.15);
        camera.up.copy(up2);
        // 注视点：中景路径（人物尺度），远景建筑自然虚化进景深分层
        const lookAt = player.position
          .clone()
          .addScaledVector(fwd, Math.max(6, d * 2.8))
          .addScaledVector(up2, 1.1);
        // 若 landmark 更远，略拉向地标，保持纵深轴
        const toLm = target.clone().sub(camera.position);
        if (toLm.lengthSq() > 1) {
          lookAt.lerp(target.clone().addScaledVector(up2, 1.4), 0.35);
        }
        camera.lookAt(lookAt);
        if (rig?.setNear) {
          try { rig.setNear(0.05); } catch {}
        } else if (camera.near != null) {
          camera.near = Math.min(camera.near, 0.08);
          camera.updateProjectionMatrix?.();
        }
      }
      // tele：中远拉距 + 窄 FOV；压缩人与远景建筑到同一平面感
      if (family === "tele" && camera && target) {
        const up2 = player.position.clone().normalize();
        const fwd = (player.forward || new T.Vector3(0, 0, 1)).clone();
        fwd.addScaledVector(up2, -fwd.dot(up2));
        if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
        fwd.normalize();
        camera.position
          .copy(player.position)
          .addScaledVector(up2, Math.max(2.0, d * 0.22))
          .addScaledVector(fwd, -d * 1.05);
        camera.up.copy(up2);
        camera.lookAt(target.clone().addScaledVector(up2, 1.6));
      }

      if (tm.renderer && camera) {
        tm.renderer.render(tm.scene, camera);
      }

      // 自检：遥控钮在 capture-clean 下应不可见
      const toggle = document.getElementById("touch-toggle");
      const slot = document.getElementById("touch-toggle-slot");
      const vis = (el) => {
        if (!el) return null;
        const st = getComputedStyle(el);
        return {
          visibility: st.visibility,
          display: st.display,
          hiddenByClean: document.documentElement.classList.contains("tm-capture-clean"),
        };
      };

      return {
        ok: true,
        landmark: landmark || null,
        family: family || null,
        fov: camera?.fov ?? null,
        cam: camera?.position?.toArray?.() || null,
        touchToggle: vis(toggle),
        touchToggleSlot: vis(slot),
      };
    },
    { landmark, dist, orbit, pitch, preset, fov, family }
  );

  await sleep(waitMs);
  await page.evaluate(async () => {
    const tm = window.__tm;
    for (let i = 0; i < 8; i++) {
      if (tm?.cameraRig?.update) tm.cameraRig.update(1 / 30);
      if (tm?.renderer && tm.camera) tm.renderer.render(tm.scene, tm.camera);
      await new Promise((r) => requestAnimationFrame(r));
    }
  });

  return {
    cameraFamily: family,
    captureClean: true,
    airshipView: null,
    meta,
  };
}

export function resolveCropRect(viewport, cropRect, cropInset) {
  if (cropRect && Number(cropRect.width) > 0 && Number(cropRect.height) > 0) {
    return {
      x: Math.max(0, Math.round(cropRect.x || 0)),
      y: Math.max(0, Math.round(cropRect.y || 0)),
      width: Math.round(cropRect.width),
      height: Math.round(cropRect.height),
    };
  }
  if (!cropInset) return null;
  const inset = { ...DEFAULT_CROP_INSET, ...cropInset };
  const w = viewport.width;
  const h = viewport.height;
  const left = Math.round(w * clamp01(inset.left));
  const top = Math.round(h * clamp01(inset.top));
  const right = Math.round(w * clamp01(inset.right));
  const bottom = Math.round(h * clamp01(inset.bottom));
  const width = Math.max(1, w - left - right);
  const height = Math.max(1, h - top - bottom);
  return { x: left, y: top, width, height };
}

function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(0.45, Math.max(0, v));
}

function pageOf(target) {
  return typeof target.page === "function" ? target.page() : target;
}

async function canvasClipRect(target) {
  const page = pageOf(target);
  const vp = page.viewportSize?.() || { width: 1280, height: 800 };
  const rect = await target.evaluate(() => {
    const tm = window.__tm;
    const canvas =
      tm?.renderer?.domElement || document.querySelector("canvas");
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const right = Math.min(vp.width, Math.ceil(rect.x + rect.width));
  const bottom = Math.min(vp.height, Math.ceil(rect.y + rect.height));
  const width = Math.max(1, right - x);
  const height = Math.max(1, bottom - y);
  if (x + width > vp.width || y + height > vp.height) {
    return {
      x: Math.min(x, vp.width - 1),
      y: Math.min(y, vp.height - 1),
      width: Math.max(1, Math.min(width, vp.width - x)),
      height: Math.max(1, Math.min(height, vp.height - y)),
    };
  }
  return { x, y, width, height };
}


/** DOM ids that must NOT be visible in formal comic frames */
export const HUD_BAN_IDS = [
  "minimap-panel",
  "quest-panel",
  "hud",
  "hint-panel",
  "controls-dock",
  "touch-toggle",
  "touch-toggle-slot",
  "tm-perf-probe",
  "bubble",
  "bubble-crosshair",
  "npc-hint",
  "toast",
  "rescue-campaign",
  "compass",
  "topleft-stack",
];

/**
 * Assert capture-clean: setCaptureMode(true), isCaptureMode, ban-list not visible.
 * Returns { ok, captureMode, visibleBanned, classClean }.
 */
async function assertCaptureClean(target) {
  return target.evaluate((banIds) => {
    const tm = window.__tm;
    if (typeof tm?.setCaptureMode === "function") tm.setCaptureMode(true);
    else if (globalThis.__tmUiLayers?.setCaptureMode)
      globalThis.__tmUiLayers.setCaptureMode(true);
    else document.documentElement.classList.add("tm-capture-clean");
    document.getElementById("intro")?.classList.add("hidden");

    const isCap =
      (typeof tm?.isCaptureMode === "function" && tm.isCaptureMode()) ||
      (typeof globalThis.__tmUiLayers?.isCaptureMode === "function" &&
        globalThis.__tmUiLayers.isCaptureMode()) ||
      document.documentElement.classList.contains("tm-capture-clean");

    const visibleBanned = [];
    for (const id of banIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const hidden =
        st.visibility === "hidden" ||
        st.display === "none" ||
        st.opacity === "0" ||
        el.hasAttribute("hidden") ||
        r.width < 1 ||
        r.height < 1;
      if (!hidden) visibleBanned.push(id);
    }
    return {
      ok: !!isCap && visibleBanned.length === 0,
      captureMode: !!isCap,
      classClean: document.documentElement.classList.contains("tm-capture-clean"),
      visibleBanned,
    };
  }, HUD_BAN_IDS);
}

async function grabPng(target, outPath, crop) {
  // 优先 canvas.toDataURL（排除 HTML HUD）；失败则 page.screenshot + clip 到 canvas 区域（策略 2）
  const page = pageOf(target);
  const dataUrl = await target.evaluate((cropRect) => {
    const tm = window.__tm;
    const canvas =
      tm?.renderer?.domElement ||
      document.querySelector("canvas");
    if (!canvas || typeof canvas.toDataURL !== "function") return null;
    try {
      if (tm?.renderer && tm.scene && tm.camera) {
        try { tm.renderer.render(tm.scene, tm.camera); } catch {}
      }
      if (
        cropRect &&
        cropRect.width > 0 &&
        cropRect.height > 0 &&
        typeof document.createElement === "function"
      ) {
        const scaleX = canvas.width / (canvas.clientWidth || canvas.width);
        const scaleY = canvas.height / (canvas.clientHeight || canvas.height);
        const sx = Math.round(cropRect.x * scaleX);
        const sy = Math.round(cropRect.y * scaleY);
        const sw = Math.round(cropRect.width * scaleX);
        const sh = Math.round(cropRect.height * scaleY);
        const off = document.createElement("canvas");
        off.width = Math.max(1, sw);
        off.height = Math.max(1, sh);
        const ctx = off.getContext("2d");
        if (!ctx) return canvas.toDataURL("image/png");
        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        return off.toDataURL("image/png");
      }
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }, crop || null);
  if (dataUrl && dataUrl.startsWith("data:image/png")) {
    const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
    return { source: crop ? "canvas-todataurl+crop" : "canvas-todataurl", cropUsed: !!crop };
  }
  // Strategy 2: clip page.screenshot to the WebGL canvas bounds (exclude surrounding HTML)
  let clip = crop || null;
  let cropUsed = !!crop;
  if (!clip) {
    clip = await canvasClipRect(target);
    cropUsed = !!clip;
  }
  // Frame coords are iframe-local; page.screenshot clip is page-local — offset by iframe box
  if (clip && target !== page) {
    const box = await page.locator("iframe#game").boundingBox().catch(() => null);
    if (box) {
      clip = {
        x: Math.round(box.x + clip.x),
        y: Math.round(box.y + clip.y),
        width: clip.width,
        height: clip.height,
      };
    }
  }
  const shotOpts = { path: outPath, type: "png" };
  if (clip) shotOpts.clip = clip;
  await page.screenshot(shotOpts);
  return {
    source: clip ? "playwright-screenshot+crop" : "playwright-screenshot",
    cropUsed,
  };
}

function copyFromDir(shotsDir, plan, outShots) {
  fs.mkdirSync(outShots, { recursive: true });
  const entries = [];
  for (const shot of plan.shots) {
    const candidates = [
      path.join(shotsDir, `${shot.id}.png`),
      path.join(shotsDir, shot.id, "shot.png"),
    ];
    const src = candidates.find((p) => fs.existsSync(p));
    const dest = path.join(outShots, `${shot.id}.png`);
    if (!src) {
      entries.push({
        shotId: shot.id,
        file: `${shot.id}.png`,
        source: "external-dir",
        ok: false,
        error: "missing",
      });
      continue;
    }
    fs.copyFileSync(src, dest);
    entries.push({
      shotId: shot.id,
      file: `${shot.id}.png`,
      source: "external-dir",
      ok: true,
    });
  }
  return entries;
}

function copyFixtures(plan, outShots, fixturesDir) {
  fs.mkdirSync(outShots, { recursive: true });
  const files = fs
    .readdirSync(fixturesDir)
    .filter((f) => f.endsWith(".png"))
    .sort();
  if (!files.length) {
    throw new Error(`fixtures 目录无 PNG: ${fixturesDir}`);
  }
  const entries = [];
  plan.shots.forEach((shot, i) => {
    const src = path.join(fixturesDir, files[i % files.length]);
    const dest = path.join(outShots, `${shot.id}.png`);
    fs.copyFileSync(src, dest);
    entries.push({
      shotId: shot.id,
      file: `${shot.id}.png`,
      source: "fixture",
      ok: true,
      fixture: path.basename(src),
    });
  });
  return entries;
}

/**
 * @param {object} plan
 * @param {{
 *   chapterDir: string,
 *   port?: number,
 *   shotsDir?: string,
 *   useFixtures?: boolean,
 *   baseUrl?: string,
 *   cropRect?: { x: number, y: number, width: number, height: number },
 *   cropInset?: { left?: number, top?: number, right?: number, bottom?: number } | true,
 *   skipCrop?: boolean,
 *   viaPipeline?: boolean,
 * }} opts
 */

/** Solid clean placeholder PNGs (no HUD pixels). Formal chapters must not ship fixture HUD. */
function writeCleanPlaceholders(plan, outShots, meta = {}) {
  fs.mkdirSync(outShots, { recursive: true });
  // 1x1 PNG is too small for layout QA; write a minimal valid 1280x800 solid via raw PPM→not.
  // Use a tiny embedded solid PNG and note in manifest; layout shows missing-style note via bytes.
  const entries = [];
  for (const shot of plan.shots) {
    const dest = path.join(outShots, `${shot.id}.png`);
    // Minimal 2x2 PNG (grey) — honest placeholder, NOT game HUD fixtures
    const b64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF+FABYBAf8qGGxTAAAAAElFTkSuQmCC";
    fs.writeFileSync(dest, Buffer.from(b64, "base64"));
    entries.push({
      shotId: shot.id,
      file: `${shot.id}.png`,
      source: "clean-placeholder",
      ok: false,
      placeholder: true,
      note: "live capture-clean 失败；拒绝使用带 HUD 的 _fixtures；待重拍",
    });
  }
  return {
    id: plan.id,
    mode: "clean-placeholder",
    realCapture: false,
    captureClean: true,
    refusedHudFixtures: true,
    note: "正式章禁止 HUD fixtures；占位图非游戏菜单截屏。请在 8931 就绪后重跑 capture。",
    captureError: meta.captureError || null,
    attemptedLive: true,
    liveAttempts: meta.liveAttempts || [],
    via: meta.via || null,
    generatedAt: new Date().toISOString(),
    shots: entries,
  };
}

export async function captureShots(plan, opts) {
  const chapterDir = opts.chapterDir;
  const outShots = path.join(chapterDir, "shots");
  fs.mkdirSync(outShots, { recursive: true });
  const fixturesDir = path.join(CARTON, "chapters/_fixtures");
  const portPref = opts.port || Number(process.env.CARTONBOOK_PORT) || null;
  const viaPipeline =
    opts.viaPipeline === true ||
    process.env.CARTONBOOK_VIA_PIPELINE === "1" ||
    plan.captureVia === "pipeline";
  const wantCrop =
    !opts.skipCrop &&
    (opts.cropRect ||
      opts.cropInset === true ||
      (opts.cropInset && typeof opts.cropInset === "object") ||
      process.env.CARTONBOOK_CROP === "1");

  if (opts.shotsDir) {
    const entries = copyFromDir(opts.shotsDir, plan, outShots);
    const manifest = {
      id: plan.id,
      mode: "external-dir",
      realCapture: false,
      shotsDir: opts.shotsDir,
      generatedAt: new Date().toISOString(),
      shots: entries,
    };
    fs.writeFileSync(
      path.join(chapterDir, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    );
    return manifest;
  }

  if (opts.useFixtures) {
    const entries = copyFixtures(plan, outShots, fixturesDir);
    const manifest = {
      id: plan.id,
      mode: "fixtures",
      realCapture: false,
      note: "使用 chapters/_fixtures（来源为本游戏既有验收截屏，非 AI 生成）",
      generatedAt: new Date().toISOString(),
      shots: entries,
    };
    fs.writeFileSync(
      path.join(chapterDir, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    );
    return manifest;
  }

  const pw = await resolvePlaywright();
  if (!pw?.chromium) {
    const err =
      "未找到 Playwright。请确认 ../tools/shot/node_modules/playwright 存在，" +
      "或 npm i playwright；也可 --shots-dir / layout-only。";
    // 退化 fixtures
    if (fs.existsSync(fixturesDir) && fs.readdirSync(fixturesDir).some((f) => f.endsWith(".png"))) {
      console.warn("[capture] " + err + " → 回退 fixtures");
      return captureShots(plan, { ...opts, useFixtures: true });
    }
    throw new Error(err);
  }

  let server;
  const entries = [];
  let realCapture = false;
  let captureError = null;
  let cropUsedAny = false;
  let via = viaPipeline ? "pipeline" : "direct";
  let port = portPref || 8766;

  try {
    // Prefer an already-open workshop server (8931) when via-pipeline / unspecified
    if (!portPref) {
      if (await portOpen(8931)) port = 8931;
      else if (viaPipeline && (await portOpen(8931))) port = 8931;
    } else if (viaPipeline && !(await portOpen(portPref)) && (await portOpen(8931))) {
      port = 8931;
    }
    server = await ensureServer(port);

    const scene = plan.scene || "messenger";
    // Direct game URL (also the pipeline iframe embed params + cartonCapture)
    let gamePath =
      plan.gameUrl ||
      `/TigerMessenger/?scene=${scene}&autostart=1&dev=1&authoringEmbed=1`;
    if (!gamePath.startsWith("http")) {
      if (!gamePath.startsWith("/")) gamePath = "/" + gamePath;
      if (plan.timeOfDay != null && !gamePath.includes("timeOfDay=")) {
        gamePath +=
          (gamePath.includes("?") ? "&" : "?") + `timeOfDay=${plan.timeOfDay}`;
      }
      if (!gamePath.includes("cartonCapture=")) {
        gamePath += (gamePath.includes("?") ? "&" : "?") + "cartonCapture=1";
      }
      if (!gamePath.includes("dev=")) {
        gamePath += (gamePath.includes("?") ? "&" : "?") + "dev=1";
      }
      if (!gamePath.includes("authoringEmbed=") && viaPipeline) {
        gamePath +=
          (gamePath.includes("?") ? "&" : "?") + "authoringEmbed=1";
      }
    }
    const gameUrl = gamePath.startsWith("http")
      ? gamePath
      : `http://127.0.0.1:${port}${gamePath}`;
    const pipelineUrl = `http://127.0.0.1:${port}/TigerMessenger/pipeline.html#scene`;

    let urlPath = viaPipeline ? pipelineUrl : gameUrl;
    if (opts.baseUrl) urlPath = opts.baseUrl;

    const wantHeaded =
      process.env.CARTONBOOK_HEADED === "1" ||
      process.env.CARTONBOOK_HEADED === "true" ||
      opts.headed === true;
    const launchOpts = {
      headless: !wantHeaded,
      args: wantHeaded
        ? [
            "--no-sandbox",
            "--ignore-gpu-blocklist",
            "--enable-webgl",
            "--disable-gpu-sandbox",
          ]
        : [
            "--no-sandbox",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist",
            "--enable-webgl",
            "--disable-gpu-sandbox",
          ],
    };
    if (fs.existsSync(CHROME)) launchOpts.executablePath = CHROME;
    else launchOpts.channel = "chrome";

    const vp = plan.viewport || { width: 1280, height: 800 };
    const cropInset =
      opts.cropInset === true || process.env.CARTONBOOK_CROP === "1"
        ? DEFAULT_CROP_INSET
        : opts.cropInset && typeof opts.cropInset === "object"
          ? opts.cropInset
          : null;
    const crop = wantCrop
      ? resolveCropRect(
          vp,
          opts.cropRect || null,
          cropInset || DEFAULT_CROP_INSET
        )
      : null;
    if (crop) {
      console.log(
        `[capture] crop fallback (strategy 2): x=${crop.x} y=${crop.y} ${crop.width}x${crop.height}`
      );
    }

    /** Boot game page/frame until __tm.camera is ready. */
    async function bootTarget(browser) {
      const page = await browser.newPage({ viewport: vp });
      page.on("pageerror", (e) => console.warn("[pageerror]", e.message));
      console.log("[capture] goto", urlPath, `(via=${via}, headed=${wantHeaded})`);
      await page.goto(urlPath, { waitUntil: "domcontentloaded", timeout: 120000 });

      /** @type {import('playwright').Page | import('playwright').Frame} */
      let target = page;
      if (viaPipeline && !opts.baseUrl) {
        await page.waitForSelector("iframe#game", { timeout: 60000 }).catch(() => {});
        let gameFrame = null;
        for (let i = 0; i < 60; i++) {
          const frames = page.frames();
          gameFrame =
            frames.find((f) => {
              try {
                const u = f.url() || "";
                return (
                  u.includes("TigerMessenger") &&
                  !u.includes("pipeline.html") &&
                  (u.includes("authoringEmbed") || u.includes("index"))
                );
              } catch {
                return false;
              }
            }) || null;
          if (gameFrame) {
            const ready = await gameFrame
              .evaluate(() => !!window.__tm?.camera)
              .catch(() => false);
            if (ready) break;
          }
          const handle = await page.$("iframe#game");
          if (handle) {
            const cf = await handle.contentFrame();
            if (cf) {
              const ready = await cf
                .evaluate(() => !!window.__tm?.camera)
                .catch(() => false);
              if (ready) {
                gameFrame = cf;
                break;
              }
            }
          }
          await sleep(500);
        }
        if (gameFrame) {
          target = gameFrame;
          console.log("[capture] using pipeline iframe frame");
        } else {
          console.warn(
            "[capture] pipeline iframe __tm 未就绪 → 回退直连 embed（authoringEmbed=1&dev=1&cartonCapture=1）"
          );
          via = "direct";
          await page.goto(gameUrl, {
            waitUntil: "domcontentloaded",
            timeout: 120000,
          });
          target = page;
        }
      }

      // Boot: dismiss intro / click start; allow up to ~5 min for __tm
      for (let i = 0; i < 60; i++) {
        const ready = await target
          .evaluate(() => !!window.__tm?.camera)
          .catch(() => false);
        if (ready) break;
        await target
          .evaluate(() => {
            const btn =
              document.getElementById("start-btn") ||
              document.querySelector(
                "[data-start], button#start, .start-btn, .start, #start"
              );
            if (btn) btn.click();
            document.getElementById("intro")?.classList.add("hidden");
            // also try keypress to dismiss overlays
            try {
              document.dispatchEvent(
                new KeyboardEvent("keydown", {
                  code: "Enter",
                  key: "Enter",
                  bubbles: true,
                })
              );
            } catch {}
          })
          .catch(() => {});
        await sleep(5000);
      }
      await target.waitForFunction(() => !!window.__tm?.camera, null, {
        timeout: 300000,
      });
      await target
        .waitForFunction(
          () =>
            !document.getElementById("intro") ||
            document.getElementById("intro").classList.contains("hidden"),
          null,
          { timeout: 60000 }
        )
        .catch(() => {});
      await target.evaluate(() => {
        const intro = document.getElementById("intro");
        if (intro) intro.classList.add("hidden");
        const tm = window.__tm;
        if (typeof tm?.setCaptureMode === "function") tm.setCaptureMode(true);
        else if (globalThis.__tmUiLayers?.setCaptureMode)
          globalThis.__tmUiLayers.setCaptureMode(true);
      });
      await sleep(1500);
      return { page, target };
    }

    function isBrowserDeadError(msg) {
      const s = String(msg || "");
      return (
        /has been closed/i.test(s) ||
        /Target closed/i.test(s) ||
        /browser has been closed/i.test(s) ||
        /Protocol error/i.test(s)
      );
    }

    let browser = await pw.chromium.launch(launchOpts);
    let page = null;
    let target = null;
    try {
      ({ page, target } = await bootTarget(browser));

      for (let si = 0; si < plan.shots.length; si++) {
        const shot = plan.shots[si];
        const dest = path.join(outShots, `${shot.id}.png`);
        let attempts = 0;
        while (attempts < 3) {
          attempts++;
          try {
            // If previous crash left browser dead, relaunch before shot
            if (!browser.isConnected()) {
              console.warn(
                `[capture] browser disconnected before ${shot.id} → relaunch`
              );
              try {
                await browser.close();
              } catch {}
              browser = await pw.chromium.launch(launchOpts);
              ({ page, target } = await bootTarget(browser));
            }
            const camMeta = await applyCamera(target, shot);
            const clean = await assertCaptureClean(target);
            if (!clean.ok) {
              const why = !clean.captureMode
                ? "isCaptureMode=false"
                : "visible HUD: " + (clean.visibleBanned || []).join(",");
              console.warn(`[capture] ${shot.id} HUD-GUARD FAIL: ${why}`);
              entries.push({
                shotId: shot.id,
                file: `${shot.id}.png`,
                source: "aborted-hud",
                ok: false,
                error: why,
                cameraFamily:
                  camMeta?.cameraFamily ||
                  resolveCameraFamily(shot.camera || {}) ||
                  null,
                captureClean: false,
                hudCheck: clean,
                airshipView: camMeta?.airshipView || null,
              });
              break;
            }
            const grab = await grabPng(target, dest, crop);
            const source = grab.source || grab;
            const cropUsed = !!(grab.cropUsed || crop);
            if (cropUsed) cropUsedAny = true;
            const ok = fs.existsSync(dest) && fs.statSync(dest).size > 1000;
            const family =
              camMeta?.cameraFamily ||
              resolveCameraFamily(shot.camera || {}) ||
              null;
            entries.push({
              shotId: shot.id,
              file: `${shot.id}.png`,
              source,
              ok,
              cropUsed,
              bytes: ok ? fs.statSync(dest).size : 0,
              cameraFamily: family,
              captureClean: true,
              airshipView: camMeta?.airshipView || null,
            });
            console.log(
              `[capture] ${shot.id} ${ok ? "OK" : "FAIL"} (${source})${family ? " [" + family + "]" : ""}`
            );
            if (ok) realCapture = true;
            break;
          } catch (e) {
            const msg = e.message || String(e);
            console.warn(
              `[capture] ${shot.id} error (attempt ${attempts}):`,
              msg
            );
            if (isBrowserDeadError(msg) && attempts < 3) {
              console.warn(
                `[capture] browser/page died on ${shot.id} → relaunch + retry`
              );
              try {
                await browser.close();
              } catch {}
              browser = await pw.chromium.launch(launchOpts);
              ({ page, target } = await bootTarget(browser));
              continue;
            }
            entries.push({
              shotId: shot.id,
              file: `${shot.id}.png`,
              source: "playwright-screenshot",
              ok: false,
              error: msg,
              cameraFamily: resolveCameraFamily(shot.camera || {}) || null,
              captureClean: true,
              airshipView: null,
            });
            break;
          }
        }
      }
      // Restore UI after series
      try {
        if (target && browser.isConnected()) {
          await target.evaluate(() => {
            const tm = window.__tm;
            if (typeof tm?.setCaptureMode === "function") tm.setCaptureMode(false);
            else if (globalThis.__tmUiLayers?.setCaptureMode)
              globalThis.__tmUiLayers.setCaptureMode(false);
          });
        }
      } catch {}
    } finally {
      try { await browser.close(); } catch {}
    }
  } catch (e) {
    captureError = e.message || String(e);
    console.warn("[capture] 失败:", captureError);
  } finally {
    if (server?.started) await server.stop();
  }

  if (!realCapture) {
    const noFixtures =
      opts.noFixtures === true ||
      process.env.CARTONBOOK_NO_FIXTURES === "1" ||
      plan.noFixtures === true ||
      plan.id === "messenger-tide-letter";
    if (noFixtures) {
      console.warn(
        "[capture] 无成功真截屏 → 拒绝 HUD fixtures；写入诚实占位（CARTONBOOK_NO_FIXTURES / 正式章）"
      );
      const placeholderManifest = writeCleanPlaceholders(plan, outShots, {
        captureError,
        liveAttempts: entries,
        via,
      });
      fs.writeFileSync(
        path.join(chapterDir, "manifest.json"),
        JSON.stringify(placeholderManifest, null, 2)
      );
      return placeholderManifest;
    }
    console.warn("[capture] 无成功真截屏 → 回退 fixtures（仍为本游戏截屏）");
    const fixtureManifest = await captureShots(plan, {
      ...opts,
      useFixtures: true,
    });
    fixtureManifest.captureError = captureError;
    fixtureManifest.attemptedLive = true;
    fixtureManifest.liveAttempts = entries;
    fixtureManifest.via = via;
    fixtureManifest.captureClean = true;
    fixtureManifest.cropUsed = cropUsedAny;
    fs.writeFileSync(
      path.join(chapterDir, "manifest.json"),
      JSON.stringify(fixtureManifest, null, 2)
    );
    return fixtureManifest;
  }

  const manifest = {
    id: plan.id,
    mode: "live",
    realCapture: true,
    port,
    via,
    captureClean: true,
    cropUsed: cropUsedAny || wantCrop,
    captureFlag: "cartonCapture=1",
    crop: wantCrop
      ? opts.cropRect ||
        (opts.cropInset === true || process.env.CARTONBOOK_CROP === "1"
          ? DEFAULT_CROP_INSET
          : opts.cropInset) ||
        DEFAULT_CROP_INSET
      : null,
    generatedAt: new Date().toISOString(),
    shots: entries,
  };
  fs.writeFileSync(
    path.join(chapterDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  return manifest;
}


export default captureShots;
