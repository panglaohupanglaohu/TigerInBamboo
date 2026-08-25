// =====================================================================
//  SurfaceRider / Mountable（G11）：玩家、电车、船、木马共用贴地，不共享战斗 AI
// =====================================================================

export function stickToSurface(provider, pos, profile) {
  const hit = provider.sample(pos, profile);
  if (!hit) return { ok: false, pos, hit: null };
  return { ok: true, pos: hit.point || hit.position || pos, hit };
}

export function createSurfaceRider(kind, provider, start, profile = {}) {
  let pos = { ...start };
  let surface = provider;
  return {
    kind,
    mountable: false,
    profile,
    get position() {
      return pos;
    },
    get provider() {
      return surface;
    },
    rebind(nextProvider, nextPos) {
      if (nextProvider) surface = nextProvider;
      if (nextPos) pos = { x: nextPos.x, y: nextPos.y, z: nextPos.z };
      return this.tick(0);
    },
    tick(_dt) {
      const stuck = stickToSurface(surface, pos, profile);
      if (stuck.ok) pos = stuck.pos;
      return stuck;
    },
  };
}

export function createMountable(kind, provider, start) {
  const rider = createSurfaceRider(kind, provider, start);
  rider.mountable = true;
  rider.passengers = [];
  rider.board = (id) => {
    rider.passengers.push(id);
  };
  rider.alight = (id) => {
    rider.passengers = rider.passengers.filter((p) => p !== id);
  };
  return rider;
}
