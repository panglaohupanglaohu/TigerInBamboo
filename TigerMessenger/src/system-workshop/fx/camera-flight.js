/**
 * fx.camera 的路径怎么驱动真实镜头（R40）：纯函数，Node 单测与 world/rea/fxLive.js 共用。
 *   poseAt(path, u)        u ∈ [0,1] → 路径上的点（按采样点线性插值；路径是 fx.camera 产出的等时采样，所以 u 匀速 = 角速度与验证时一致）
 *   sweepDeg(points, c)    一串 (x,z) 绕中心 c 扫过的角度（逐段取 (-180°,180°] 的差再累加），用来证明「真的飞了一圈」
 *   flightPlan(camera, o)  从 plan.camera 取时长、圈数、中心；o.seconds 可覆盖时长（不改路径，只改快慢）
 * 镜头始终看向舞台中心；回退时还原进入飞行前的镜头位置、朝向、视角和镜头控制（见 fxLive.js stopCameraFlight）。
 */
export function poseAt(path, u) {
  if (!Array.isArray(path) || !path.length) throw Error('没有镜头路径');
  if (path.length === 1) return { x: path[0].x, y: path[0].y, z: path[0].z };
  const t = Math.max(0, Math.min(1, Number.isFinite(u) ? u : 0)) * (path.length - 1), i = Math.min(path.length - 2, Math.floor(t)), k = t - i, a = path[i], b = path[i + 1];
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
}

export function sweepDeg(points, centre = [0, 0]) {
  let signed = 0, absolute = 0, prev = null;
  for (const p of points || []) {
    const a = Math.atan2(p[1] - centre[1], p[0] - centre[0]);
    if (prev !== null) { let d = a - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI; signed += d; absolute += Math.abs(d); }
    prev = a;
  }
  return { signed: +(signed * 180 / Math.PI).toFixed(2), absolute: +(absolute * 180 / Math.PI).toFixed(2) };
}

export function flightPlan(camera, { seconds = null } = {}) {
  const path = camera?.path;
  if (!Array.isArray(path) || path.length < 2) throw Error('计划里没有 fx.camera 路径（先在表现层管线里执行「环绕镜头路径」）');
  const s = Number.isFinite(+seconds) && +seconds > 0 ? Math.min(120, +seconds) : camera.seconds || 12;
  const yaw = path.at(-1).yaw - path[0].yaw, laps = Number.isFinite(yaw) ? +(yaw / (2 * Math.PI)).toFixed(3) : null;
  const centre = Array.isArray(camera.centre) ? camera.centre : [0, 0];
  return { seconds: s, laps, centre, points: path.length, expectedSweep: sweepDeg(path.map((p) => [p.x, p.z]), centre) };
}
