// =====================================================================
//  莫比斯湖沼 BGM 滞回判定（从 messengerIsland 抽出）
// =====================================================================
import * as THREE from "three";
import { setSwampBgm } from "../../audio/sfx.js";

const _swampLocal = new THREE.Vector3();
// One cache per existing BGM state; no permanent references after state disposal.
// Missing roots are deliberately not cached: a later scene load must be found.
const swampRoots = new WeakMap();
function findSwamp(state, scene) {
  const cached = swampRoots.get(state);
  if (cached?.scene === scene && cached.root?.userData?.kind === "moebius-swamp" && cached.rootCount === scene.children.length) {
    let ancestor = cached.root;
    while (ancestor && ancestor !== scene) ancestor = ancestor.parent;
    if (ancestor === scene) return cached.root;
  }
  let root = null;
  scene.traverse((o) => {
    if (!root && o.userData?.kind === "moebius-swamp") root = o;
  });
  swampRoots.set(state, { scene, root, rootCount: scene.children.length });
  return root;
}
export const SWAMP_BGM_ENTER_R = 33;
export const SWAMP_BGM_EXIT_R = 37;
export const SWAMP_BGM_CEILING = 28;

export function createSwampBgmState() {
  return { inside: false };
}

export function tickSwampBgm(state, scene, player) {
  let swamp = null;
  if (player) swamp = findSwamp(state, scene);
  if (player && swamp) {
    swamp.updateWorldMatrix(true, false);
    _swampLocal.copy(player.position);
    swamp.worldToLocal(_swampLocal);
    const horiz = Math.hypot(_swampLocal.x, _swampLocal.z);
    if (state.inside) {
      if (horiz > SWAMP_BGM_EXIT_R || _swampLocal.y > SWAMP_BGM_CEILING + 6) state.inside = false;
    } else if (horiz < SWAMP_BGM_ENTER_R && _swampLocal.y < SWAMP_BGM_CEILING) {
      state.inside = true;
    }
  } else {
    state.inside = false;
  }
  setSwampBgm(state.inside);
}
