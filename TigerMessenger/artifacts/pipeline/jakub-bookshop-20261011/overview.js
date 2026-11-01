// Jakub 书店镇对照机位：自由相机，书店镇根节点（bookshop-steampunk-robots）局部坐标。
// 目标图视角：从海侧（+z）斜上方 35–45° 看向三厂（-z），港口在画面左（-x）。
const tm = () => window.__tm;
const root = () => tm().scene.getObjectByName('bookshop-steampunk-robots');
export function render({az = 0, pitch = .7, dist = 120, fov = 40, tx = -6, ty = 4, tz = 20, w = 1600, h = 1000} = {}) {
  const T = tm().THREE, r = tm().renderer, cam = tm().camera, scene = tm().scene, R = root();
  R.updateWorldMatrix(true, false);
  const target = R.localToWorld(new T.Vector3(tx, ty, tz));
  const eye = R.localToWorld(new T.Vector3(tx + Math.sin(az) * Math.cos(pitch) * dist, ty + Math.sin(pitch) * dist, tz + Math.cos(az) * Math.cos(pitch) * dist));
  const save = {pos: cam.position.clone(), quat: cam.quaternion.clone(), up: cam.up.clone(), fov: cam.fov, aspect: cam.aspect, near: cam.near, far: cam.far, size: r.getSize(new T.Vector2()), pr: r.getPixelRatio()};
  try {
    r.setPixelRatio(1); r.setSize(w, h, false);
    cam.up.copy(new T.Vector3(0, 1, 0).transformDirection(R.matrixWorld));
    cam.position.copy(eye); cam.lookAt(target); cam.fov = fov; cam.aspect = w / h; cam.near = .5; cam.far = 4000; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    r.render(scene, cam);
    return r.domElement.toDataURL('image/jpeg', .9);
  } finally {
    r.setPixelRatio(save.pr); r.setSize(save.size.x, save.size.y, false);
    cam.position.copy(save.pos); cam.quaternion.copy(save.quat); cam.up.copy(save.up); cam.fov = save.fov; cam.aspect = save.aspect; cam.near = save.near; cam.far = save.far; cam.updateProjectionMatrix();
  }
}
export function show(o = {}) {
  const u = render(o); document.getElementById('station-sheet')?.remove();
  const i = document.createElement('img'); i.id = 'station-sheet'; i.src = u;
  i.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:62.5vw;z-index:2147483647;object-fit:fill;background:#000';
  document.body.appendChild(i); return 'ok';
}
