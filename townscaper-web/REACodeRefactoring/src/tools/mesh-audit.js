import * as THREE from 'three';

/** Measure only the merged World surface, not water/vegetation/shadows/UI.
 * Reuses existing buffers; no duplicate editable scene or new geometry allocation. */
export function measureWorldSurface(view) {
  const renderer=view.renderer, geometry=view.worldMesh.geometry;
  const scene=new THREE.Scene(), mesh=new THREE.Mesh(geometry,view.material);
  mesh.frustumCulled=false;scene.add(mesh);
  const autoReset=renderer.info.autoReset,target=renderer.getRenderTarget(),shadow=renderer.shadowMap.enabled;
  try {
    renderer.setRenderTarget(null);renderer.shadowMap.enabled=false;
    renderer.info.autoReset=false;renderer.info.reset();renderer.render(scene,view.camera);
    return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,vertices:geometry.getAttribute('position').count,chunks:view.worldMesh.stats.chunks,groups:geometry.groups.length,scope:'Merged World surface only; excludes effects, water, shadows and outlines'};
  } finally {
    renderer.info.autoReset=autoReset;renderer.shadowMap.enabled=shadow;renderer.setRenderTarget(target);
    renderer.info.reset();view.render(0);
  }
}
