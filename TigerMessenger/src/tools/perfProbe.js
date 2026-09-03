// =====================================================================
// 常驻性能探针（2026-09-01 卡顿治理）
//
// 主页实测 4700+ draw calls @10fps —— CPU 提交瓶颈。任何优化都必须先能
// 量出数字，否则改完不知道有没有用。本模块提供：
//   · 左下角常驻 HUD（0.5s 刷新一次，不每帧写 DOM）
//   · snapshot() 供 console / e2e 读取
//   · capture() 下载当前画布（原 OskSta 面板的截图能力并入此处）
//
// 快捷键：F9 截图，F10 显隐 HUD。
// =====================================================================

const HUD_STORAGE_KEY = "tm.perfProbe.visible";

export function createPerfProbe(renderer, { bootStartMs = 0, visible = null } = {}) {
  if (!renderer || typeof document === "undefined") return null;

  const el = document.createElement("div");
  el.id = "tm-perf-probe";
  el.style.cssText =
    "position:fixed;left:8px;bottom:8px;z-index:9999;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;" +
    "background:rgba(0,0,0,.62);color:#9fe;padding:6px 8px;white-space:pre;pointer-events:none;border-radius:6px";

  let shown = visible;
  if (shown === null) {
    try {
      shown = localStorage.getItem(HUD_STORAGE_KEY) !== "0";
    } catch {
      shown = true;
    }
  }
  el.style.display = shown ? "block" : "none";
  document.body.appendChild(el);

  let bootMs = null;
  let last = null;
  let acc = 0;
  const frames = [];
  // 滞后一帧都不行：A/B 对照时旧配置的帧会污染均值，改配置后必须 reset()
  const WINDOW = 60;
  // 卡顿单独计：均值会把尖峰摩平，而卡顿才是玩家真正能感知的东西
  const HITCH_MS = 100;
  let hitches = 0;
  let worstMs = 0;

  const avgFrameMs = () =>
    frames.length ? frames.reduce((sum, v) => sum + v, 0) / frames.length : 0;

  const snapshot = () => {
    const info = renderer.info;
    const avg = avgFrameMs();
    return {
      fps: avg > 0 ? +(1000 / avg).toFixed(1) : null,
      frameMs: +avg.toFixed(2),
      samples: frames.length,
      windowFull: frames.length >= WINDOW,
      hitches,
      worstMs: +worstMs.toFixed(1),
      calls: info.render.calls,
      triangles: info.render.triangles,
      programs: info.programs?.length ?? null,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      bootMs,
    };
  };

  /**
   * 下载当前画布。preserveDrawingBuffer 默认 false，所以必须在渲染同一帧内取；
   * 这里主动重绘一次再抓，避免拿到空白图。
   */
  const capture = (filename, scene = null, camera = null) => {
    if (scene && camera) renderer.render(scene, camera);
    const name = filename || `tm-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    const canvas = renderer.domElement;
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.warn("[perf] 截图为空——请在 requestAnimationFrame 内调用，或传入 scene/camera");
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (error) {
      console.warn("[perf] 截图失败：", error?.message);
    }
    return name;
  };

  const setVisible = (next) => {
    shown = next !== false;
    el.style.display = shown ? "block" : "none";
    try {
      localStorage.setItem(HUD_STORAGE_KEY, shown ? "1" : "0");
    } catch {
      /* private mode */
    }
  };

  return {
    update(dt) {
      const now = performance.now();
      if (bootMs === null) bootMs = Math.round(now - bootStartMs);
      if (last !== null) {
        const interval = now - last;
        // 卡顿要在均值过滤之前统计：>250ms 的帧恰恰是玩家最有感的那些，
        // 之前它们被直接丢弃，等于把「卡顿」从仪表上抹掉了。
        // 上限 2s 视为切后台/断点，不算卡顿。
        if (interval >= HITCH_MS && interval < 2000) {
          hitches++;
          if (interval > worstMs) worstMs = interval;
        }
        // 均值仍只收 <250ms 的帧，避免一次挂起把 frameMs 拉飞
        if (interval > 0 && interval < 250) {
          frames.push(interval);
          if (frames.length > WINDOW) frames.shift();
        }
      }
      last = now;

      acc += Number(dt) || 0;
      if (acc < 0.5 || !shown) return;
      acc = 0;
      const s = snapshot();
      el.textContent =
        `fps    ${s.fps ?? "--"}  (${s.frameMs}ms)\n` +
        `calls  ${s.calls}\n` +
        `tris   ${(s.triangles / 1000).toFixed(0)}k\n` +
        `progs  ${s.programs ?? "?"}\n` +
        `hitch  ${s.hitches}  worst ${s.worstMs}ms\n` +
        `geoms  ${s.geometries}\n` +
        `texs   ${s.textures}\n` +
        `boot   ${s.bootMs}ms`;
    },
    snapshot,
    capture,
    /** 清空滞后窗口。改完渲染配置后必调，否则读数里混着旧配置的帧。 */
    reset() {
      frames.length = 0;
      last = null;
      acc = 0;
      hitches = 0;
      worstMs = 0;
    },
    /** 等窗口重新填满（低帧率下 60 帧可能要十几秒），超时则返回现有样本。 */
    async settle(timeoutMs = 30000) {
      const started = performance.now();
      while (frames.length < WINDOW && performance.now() - started < timeoutMs) {
        await new Promise((r) => setTimeout(r, 250));
      }
      return snapshot();
    },
    setVisible,
    isVisible: () => shown,
    dispose() {
      el.remove();
    },
  };
}
