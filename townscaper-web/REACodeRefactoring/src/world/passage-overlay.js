/** 886199305522085890 · "Dotted lines to mark narrow passages" —— 通用（非 badnorth 专用）窄道点线层。
 *
 * 片子里那条线是**调试层**：只在「两块实体之间那一格宽」的地方出现，点贴地、点距 ≈ 2 倍点径，
 * 被屋檐/崖脊挡住时逐点淡出（不是被深度硬切）。r54 之前这套东西只长在 `src/badnorth/battle.js`
 * 的 `refreshPassages()` 里 —— 换一个场景就开不了，这也是本条最后一个「仍缺」。
 *
 * 本模块把那段逻辑抽出来，任何 World + nav 图都能挂：
 *   const ol = new PassageOverlay({ levelHeight: 0.5 });
 *   ol.refresh(world, buildNav(world));            // 建点阵 + 遮挡栅格
 *   scene.add(ol.object); ol.setVisible(true);
 *   ol.update(camera, dt);                          // 每帧（相机不动时只做缓动）
 *
 * 口径（与 `src/world/traffic.js` 同源）：
 *   - 点只落在 `passageMarkers()` 认定的窄格 / 楼梯边上（判据 = 可走图本身，不是几何猜测）；
 *   - 世界尺寸点（默认）：点径 = `dotWorld`（0.13 = `spacing` 0.28 的 1/2.15），点距 = `spacing` → 任何距离下点距:点径 ≈ 2.15（原片口径）；
 *     远景按 `minPx` 兜底，否则世界尺寸点会小到看不见；
 *   - 屏幕尺寸点（`worldSize:false`）：点径固定 `screenPx`，远景可读但近景会显疏（旧口径，留作对照）。
 */
import * as THREE from 'three';
import { passageMarkers, heightRaster, sightFade } from './traffic.js';
import { installPointFloor, syncPointFloor, pointPx } from './point-floor.js';

export class PassageOverlay {
  constructor({ levelHeight = 0.5, spacing = 0.28, worldSize = true, dotWorld = 0.13, screenPx = 7, minPx = 4, fadeRate = 8, dotColor = '#ffffff' } = {}) {
    if (![levelHeight, spacing, dotWorld, screenPx, minPx, fadeRate].every(Number.isFinite)) throw new RangeError('Invalid passage overlay parameters');
    if (!(spacing > 0) || !(dotWorld > 0) || !(screenPx > 0) || !(minPx > 0)) throw new RangeError('Invalid passage overlay sizes');
    Object.assign(this, { levelHeight, spacing, worldSize, dotWorld, screenPx, minPx, fadeRate });
    // 点是**贴图圆点**而不是方形：原片一颗一颗分开，方点近看是格子。
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g2 = cv.getContext('2d');
    g2.beginPath(); g2.arc(32, 32, 26, 0, Math.PI * 2); g2.fillStyle = '#fff'; g2.fill();
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.PointsMaterial({
      color: dotColor, size: worldSize ? dotWorld : screenPx, sizeAttenuation: worldSize,
      map: tex, transparent: true, alphaTest: 0, depthWrite: false, toneMapped: false,
    });
    // 逐点 alpha：淡出必须走属性（改 material.opacity 是整层一起变）
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute float aFade;\nvarying float vFade;\n' + sh.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvFade = aFade;');
      sh.fragmentShader = 'varying float vFade;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.a *= vFade;');
    };
    // 世界尺寸点的「远景看不见」不能靠整体抬 size（那会把近端也钉死），要逐点在着色器里托底：
    // 下限单位是物理像素 = `minPx`(CSS) × devicePixelRatio（见 point-floor.js）。
    if (worldSize) installPointFloor(mat, { minPx });
    else installPointFloor(mat, { minPx: 0 });
    this.material = mat;
    this.points = new THREE.Points(new THREE.BufferGeometry(), mat);
    this.points.renderOrder = 6;
    this.points.visible = false;
    this.object = this.points;
    this.fade = new Float32Array(0); this._target = null;
    this._fadeAt = new THREE.Vector3(1e9, 1e9, 1e9);
    this._stats = { segments: 0, dots: 0, narrow: 0, occluded: 0, spacing: this.spacing, dotWorld: this.dotWorld, worldSize };
  }

  /** 建点阵。`surfaces` 可传 [mesh] 做一次向下射线贴地（地形有软坡/台阶时用），
   *  不传就按 `nav.hgt * levelHeight + 0.035` 直接放（量化格顶场景够用，且没有射线开销）。 */
  refresh(world, nav, { surfaces = [] } = {}) {
    const markers = passageMarkers(world, nav, { spacing: this.spacing, levelHeight: this.levelHeight });
    const positions = [];
    const ray = surfaces.length ? new THREE.Raycaster() : null;
    const down = new THREE.Vector3(0, -1, 0);
    if (ray) for (const s of surfaces) s.updateMatrixWorld(true);
    for (const p of markers.points) {
      let y = p.y;
      if (ray) {
        ray.set(new THREE.Vector3(p.x, 20, p.z), down);
        const hits = ray.intersectObjects(surfaces, false).filter((h) => h.face?.normal.y > 0.25);
        if (!hits.length) continue;
        // 取**最接近插值高度**的那个水平面：台阶下沿的挑檐会在射线里排第一，直接取 hits[0] 会把点埋进崖壁。
        let best = hits[0];
        for (const h of hits) if (Math.abs(h.point.y - p.y) < Math.abs(best.point.y - p.y)) best = h;
        y = best.point.y + 0.035;
      }
      positions.push(p.x, y, p.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const n = positions.length / 3;
    geo.setAttribute('aFade', new THREE.Float32BufferAttribute(new Float32Array(n).fill(1), 1));
    this.points.geometry.dispose();
    this.points.geometry = geo;
    this.fade = this.points.geometry.getAttribute('aFade').array;
    this._target = new Float32Array(n).fill(1);
    this._fadeAt.set(1e9, 1e9, 1e9);
    this.raster = heightRaster(world, { levelHeight: this.levelHeight });
    this.markers = markers;
    let narrow = 0; for (let i = 0; i < markers.narrow.length; i++) if (markers.narrow[i]) narrow++;
    this._stats = { ...this._stats, segments: markers.segments.length, dots: n, narrow, occluded: 0 };
    return this._stats;
  }

  setVisible(on) { this.points.visible = !!on; }

  /** 每帧：相机不动时只做缓动（重算视线的成本与点数成正比）。 */
  update(camera, dt = 1 / 60) {
    const g = this.points.geometry, pos = g.getAttribute('position');
    if (!pos || !this.raster) return this._stats;
    const n = pos.count;
    camera.updateMatrixWorld(true);
    if (!this._target || this._target.length !== n) this._target = new Float32Array(n).fill(1);
    if (camera.position.distanceToSquared(this._fadeAt) > 1e-4) {
      this._fadeAt.copy(camera.position);
      const p = new THREE.Vector3(); let occ = 0;
      for (let i = 0; i < n; i++) {
        p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const f = sightFade(this.raster, camera.position, p);
        this._target[i] = f;
        if (f < 0.5) occ++;
      }
      this._stats.occluded = occ;
    }
    const k = 1 - Math.exp(-this.fadeRate * Math.max(0.016, dt));
    for (let i = 0; i < n; i++) {
      const d = this._target[i] - this.fade[i];
      if (Math.abs(d) > 1e-4) this.fade[i] += d * k;
    }
    g.getAttribute('aFade').needsUpdate = true;
    if (this.worldSize) syncPointFloor(this.material.userData.pointFloor, this.minPx, this.pixelRatio());
    this._stats.dotPx = this.dotPx(camera);
    return this._stats;
  }

  /** 当前机位下的点径（屏幕像素）：世界尺寸点按 three 的 sizeAttenuation 公式算，并套 minPx 下限。 */
  dotPx(camera, viewportHeight = globalThis.innerHeight || 900) {
    if (!this.worldSize) return this.screenPx;
    const geo = this.points.geometry; geo.computeBoundingSphere();
    const c = geo.boundingSphere?.center;
    if (!c) return this.dotWorld;
    const depth = camera.position.distanceTo(c);
    // 第 164 轮改正：three 的 sizeAttenuation 是 `size·(H_css/2)/depth`，**没有** 1/tan(fov/2) 因子
    // （之前带 fovK 会高估 2.1×，把「按 px 反算 size」的调参缩到实际的 1/2）。
    return pointPx(this.dotWorld, depth, viewportHeight, this.minPx).px;
  }

  /** 量具：点距（投影 px）/ 点径（px）**在同一深度上**取中位数 + 该机位下被遮住的点数。
   *  两边必须同深度：拿云心深度算点径、拿局部点距比，会把近端的比例读偏（第一版 1.51 ≠ 2）。 */
  measure(camera, viewport = { width: globalThis.innerWidth || 1440, height: globalThis.innerHeight || 900 }) {
    const pitch = [], ratio = [], ratios = {};
    if (this.markers) {
      let i = 0;
      for (const s of this.markers.segments) {
        const p0 = this.markers.points[i], p1 = this.markers.points[i + 1];
        if (s.count >= 2 && p0 && p1) {
          const v0 = new THREE.Vector3(p0.x, p0.y, p0.z), v1 = new THREE.Vector3(p1.x, p1.y, p1.z);
          const depth = (camera.position.distanceTo(v0) + camera.position.distanceTo(v1)) / 2;
          const q0 = v0.project(camera), q1 = v1.clone().project(camera);
          if (q0.z < 1 && q1.z < 1) {
            const px = Math.hypot((q0.x - q1.x) * 0.5 * viewport.width, (q0.y - q1.y) * 0.5 * viewport.height);
            const diam = this.worldSize ? pointPx(this.dotWorld, depth, viewport.height, this.minPx).px : this.screenPx;
            pitch.push(px); ratio.push(px / diam);
            ratios[s.a + ':' + s.b] = +(px / diam).toFixed(3);
          }
        }
        i += s.count;
      }
    }
    pitch.sort((a, b) => a - b); ratio.sort((a, b) => a - b);
    const mid = (a) => (a.length ? a[a.length >> 1] : 0);
    return {
      dotPx: +this.dotPx(camera, viewport.height).toFixed(2),
      pitchPx: +mid(pitch).toFixed(2), ratio: +mid(ratio).toFixed(2),
      samples: pitch.length, occluded: this._stats.occluded, dots: this._stats.dots, ratios,
    };
  }

  pixelRatio() { const p = this.material?.userData?.pointFloor?.pixelRatio; return p > 0 ? p : 1; }
  /** 下限：CSS 像素与物理像素都给出来（物理 = CSS × devicePixelRatio）。 */
  floor() {
    const s = this.material?.userData?.pointFloor;
    return { css: this.worldSize ? this.minPx : 0, px: s ? s.uniform.value : 0, pixelRatio: this.pixelRatio() };
  }
  stats() { return { ...this._stats, visible: this.points.visible, materialSize: this.material.size, sizeAttenuation: this.material.sizeAttenuation, floor: this.floor() }; }
}
