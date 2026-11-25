import * as THREE from 'three';

/**
 * 1401145625572425728：片 0036–0078 的三角线框是「白线叠在着色表面上」，不是把面挖空。
 * 直接对合并后的单一主体几何取线框边（共享边去重），叠一层只画线、不写深度的 LineSegments。
 * 只读现有 geometry，不新建几何/不复制顶点以外的状态。
 */
export function wireOverlay(geometry, { color = 0xffffff, opacity = 1 } = {}) {
  if (!geometry?.getAttribute?.('position')) throw new TypeError('geometry with position required');
  const g = new THREE.WireframeGeometry(geometry);
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const o = new THREE.LineSegments(g, m);
  o.name = 'merged-wire-overlay';
  o.frustumCulled = false;
  o.renderOrder = 6;
  o.userData.segments = g.getAttribute('position').count / 2;
  return o;
}

export function removeWireOverlay(view) {
  const o = view.scene.getObjectByName('merged-wire-overlay');
  if (!o) return false;
  view.scene.remove(o); o.geometry.dispose(); o.material.dispose();
  return true;
}
