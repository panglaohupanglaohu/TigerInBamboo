// =====================================================================
//  贴地运动：SurfaceProvider.projectTo；失败刹车并请求重寻路（G6）
// =====================================================================

const TAU = Math.PI * 2;

export function updateMovement(agent, dt, provider, path) {
  if (agent.downed || agent.dead) return { slipped: false, off: 0 };
  const pts = path || agent.path.points;
  const look = pts[Math.min(pts.length - 1, agent.path.index + 1)] || agent.position;
  const dx = look.x - agent.position.x;
  const dz = look.z - agent.position.z;
  const len = Math.hypot(dx, dz) || 1e-6;
  const speed = Math.min(agent.maxSpeed, len * 4);
  const proposed = {
    x: agent.position.x + (dx / len) * speed * dt,
    y: agent.position.y,
    z: agent.position.z + (dz / len) * speed * dt,
  };
  const sid = look.surfaceId || agent.path.currentSurfaceId;
  let hit = sid ? provider.projectTo(sid, proposed) : null;
  if (!hit) hit = provider.sample(proposed, agent);
  if (!hit || hit.edgeDistance < agent.radius * 0.15) {
    agent.blockedT += dt;
    agent.velocity = { x: 0, y: 0, z: 0 };
    return { slipped: false, off: 0, brake: true };
  }
  agent.blockedT = 0;
  agent.position = { ...hit.point };
  agent.up = hit.normal;
  agent.path.currentSurfaceId = hit.surfaceId;
  const vlen = speed;
  agent.velocity = { x: (dx / len) * vlen, y: 0, z: (dz / len) * vlen };
  agent.gaitPhase = (agent.gaitPhase + (vlen / agent.strideLength) * TAU * dt) % TAU;
  if (vlen < 0.05) agent.gaitPhase += (0 - agent.gaitPhase) * Math.min(1, dt * 6);
  const off = Math.abs(agent.position.y - hit.point.y);
  if (len < 0.45) agent.path.index = Math.min(pts.length - 1, agent.path.index + 1);
  return { slipped: false, off, brake: false };
}
