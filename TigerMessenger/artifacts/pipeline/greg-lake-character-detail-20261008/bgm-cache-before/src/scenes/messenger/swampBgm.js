// =====================================================================
//  莫比斯湖沼 BGM 滞回判定（从 messengerIsland 抽出）
// =====================================================================
import * as THREE from "three";
import { setSwampBgm } from "../../audio/sfx.js";

const _swampLocal = new THREE.Vector3();
export const SWAMP_BGM_ENTER_R = 33;
export const SWAMP_BGM_EXIT_R = 37;
export const SWAMP_BGM_CEILING = 28;

export function createSwampBgmState() {
  return { inside: false };
}

export function tickSwampBgm(state, scene, player) {
  let swamp = null;
  if (player) {
    scene.traverse((o) => {
      if (!swamp && o.userData?.kind === "moebius-swamp") swamp = o;
    });
  }
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
