// =====================================================================
//  纸兵外观绑定：姿态只订阅 gait/attack，不判命中（V6-G5）
//  纯数据。Three 网格在 paperMesh.js。
// =====================================================================

export function applyPaperPose(parts, gait, attack) {
  if (!parts) return parts;
  const set = (obj, z) => {
    if (!obj) return;
    if (obj.rotation) obj.rotation.z = z;
    else obj.rotZ = z;
  };
  set(parts.legL, gait.legL);
  set(parts.legR, gait.legR);
  set(parts.armL, gait.armL);
  set(parts.armR, gait.armR);
  set(parts.spear, attack.spear * 0.6);
  set(parts.shield, attack.shield * 0.5);
  if (parts.torch) set(parts.torch, 0.7);
  if (parts.torso && gait.amp != null) {
    if (parts.torso.rotation) parts.torso.rotation.x = gait.amp * 0.08;
    else parts.torso.rotX = gait.amp * 0.08;
  }
  return parts;
}

export function syncPaperTransform(visual, agent) {
  if (!visual || !agent) return visual;
  visual.position = { ...agent.position };
  visual.surfaceId = agent.path.currentSurfaceId;
  return visual;
}
