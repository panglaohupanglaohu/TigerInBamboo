import * as THREE from 'three';

/**
 * 平面反射（RTT）· 1758250248483278925 "New water reflection I'm quite happy with"
 *                                     + 1215644531221311488 "…the same as in Bad North"
 *
 * 与 r181 之前的"镜像双网格"（`reflection.js` + `view.js` 里 `scale.y=-1` 的同一份 geometry）不同：
 * 那套东西整体躺在岛体**正下方**，与岛体水平范围完全重合，从水面之上的相机看被岛体深度吃掉，
 * 根本没有机会画到岛外的水面上（r181 实测主场景倒影层 0 px）。
 *
 * 这里做真正的平面反射：
 *   ① 镜像相机 —— 把相机的位置/朝向绕水面 y=planeY 反射；
 *   ② 斜近平面裁剪 —— 用 oblique frustum 把水面以下的几何裁掉（不然会看到"倒立的岛"被水面下的部分挡住）；
 *   ③ 屏幕空间 UV —— 把世界坐标经 bias·P·V 投到反射图，交给水面材质取样；
 *   ④ 遮挡免费成立 —— 水面像素被岛体挡住就不会画（水面 depthWrite=false + 岛体后画），
 *      所以"岛后面的水面没有倒影"不需要额外算。
 *
 * 渲染目标清成 alpha=0：反射图里没有几何的地方 alpha 为 0，水面按 alpha 混色，
 * 不会把天空色二次叠到水色上（这也是 r181 旧实现里 `uSky` 混色的坑）。
 */
export class PlanarReflection {
  constructor({ renderer, scene, size = 512, clipBias = 0.003 } = {}) {
    if (!renderer || !scene) throw new TypeError('planar reflection needs renderer + scene');
    this.renderer = renderer;
    this.scene = scene;
    this.enabled = false;
    this.clipBias = clipBias;
    this.rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.UnsignedByteType, depthBuffer: true });
    this.rt.texture.minFilter = THREE.LinearFilter;
    this.rt.texture.magFilter = THREE.LinearFilter;
    this.rt.texture.generateMipmaps = false;
    this.virtualCamera = new THREE.PerspectiveCamera();
    this.textureMatrix = new THREE.Matrix4();
    this.plane = new THREE.Plane();
    this.clipPlane = new THREE.Vector4();
    this.q = new THREE.Vector4();
    this.target = new THREE.Vector3();
    this.camPos = new THREE.Vector3();
    this.rot = new THREE.Matrix4();
    this.lookAt = new THREE.Vector3();
    this.view = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.normal = new THREE.Vector3(0, 1, 0);
    this.stats = { renders: 0, ms: 0, width: size, height: size };
  }

  get texture() { return this.rt.texture; }

  setSize(w, h) {
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 8 || h < 8) throw new RangeError('reflection size');
    if (this.rt.width === w && this.rt.height === h) return;
    this.rt.setSize(w, h);
    this.stats.width = w;
    this.stats.height = h;
  }

  /**
   * 渲染一次反射图，并把 world→uv 矩阵写进 textureMatrix。
   * @param {THREE.Camera} camera 主相机
   * @param {{hide?: THREE.Object3D[], planeY?: number}} opts 反射通道里要临时隐藏的对象（水面/裙带/倒影本身…）
   */
  update(camera, { hide = [], planeY = 0 } = {}) {
    if (!this.enabled) return null;
    const t0 = (globalThis.performance || Date).now();
    const r = this.renderer, s = this.scene, vc = this.virtualCamera;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    // 半分辨率就够（倒影是低对比的暗块），但至少 256
    this.setSize(Math.max(256, Math.min(1024, Math.floor(size.x / 2))), Math.max(256, Math.min(1024, Math.floor(size.y / 2))));

    // ---- ① 镜像相机 ----
    this.camPos.setFromMatrixPosition(camera.matrixWorld);
    this.rot.extractRotation(camera.matrixWorld);
    const planePoint = this.target.set(0, planeY, 0);
    this.view.copy(planePoint).sub(this.camPos);
    this.view.reflect(this.normal).negate().add(planePoint);

    this.lookAt.set(0, 0, -1).applyMatrix4(this.rot).add(this.camPos);
    const lookTarget = new THREE.Vector3().copy(planePoint).sub(this.lookAt);
    lookTarget.reflect(this.normal).negate().add(planePoint);

    vc.position.copy(this.view);
    vc.up.set(0, 1, 0).applyMatrix4(this.rot).reflect(this.normal);
    vc.lookAt(lookTarget);
    vc.near = camera.near;
    vc.far = camera.far;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);

    // ---- ② 斜近平面：把水面以下的几何裁掉 ----
    this.plane.setFromNormalAndCoplanarPoint(this.normal, planePoint);
    this.plane.applyMatrix4(vc.matrixWorldInverse);
    this.clipPlane.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
    const p = vc.projectionMatrix.elements;
    this.q.x = (Math.sign(this.clipPlane.x) + p[8]) / p[0];
    this.q.y = (Math.sign(this.clipPlane.y) + p[9]) / p[5];
    this.q.z = -1;
    this.q.w = (1 + p[10]) / p[14];
    this.clipPlane.multiplyScalar(2 / this.clipPlane.dot(this.q));
    p[2] = this.clipPlane.x;
    p[6] = this.clipPlane.y;
    p[10] = this.clipPlane.z + 1 - this.clipBias;
    p[14] = this.clipPlane.w;

    // ---- ③ world → 反射图 uv ----
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);

    // ---- 渲染：背景清成透明，临时隐藏水面/裙带/倒影层 ----
    const savedRT = r.getRenderTarget();
    const savedBg = s.background;
    const savedClear = r.getClearColor(new THREE.Color());
    const savedAlpha = r.getClearAlpha();
    const savedVis = hide.map((o) => o.visible);
    hide.forEach((o) => { o.visible = false; });
    s.background = null;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(s, vc);
    r.setRenderTarget(savedRT);
    r.setClearColor(savedClear, savedAlpha);
    s.background = savedBg;
    hide.forEach((o, i) => { o.visible = savedVis[i]; });

    this.stats.renders++;
    this.stats.ms = +((globalThis.performance || Date).now() - t0).toFixed(2);
    return this.textureMatrix;
  }

  dispose() {
    this.rt.dispose();
  }
}

export function makePlanarReflection(opts) { return new PlanarReflection(opts); }
