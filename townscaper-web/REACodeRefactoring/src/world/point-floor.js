/** 886199305522085890 · 点精灵的「物理像素下限」。
 *
 * three 的 `PointsMaterial` 只有**一个全局 size 标量**：
 *   - `sizeAttenuation:true`（世界尺寸）→ 远端的点会小到看不见，近端才够大；
 *   - `sizeAttenuation:false`（屏幕尺寸）→ 远近一样大，近景就显疏（旧口径）。
 * 想「近端随距离放大 + 远端保底可读」只能**逐点**在顶点着色器末尾对 `gl_PointSize` 取 max：
 *
 *   gl_PointSize = max( gl_PointSize, uPointFloor );
 *
 * 单位提醒（r164 实测）：three 的 size 走 `uniforms.size.value = material.size * pixelRatio`、
 * `uniforms.scale.value = height * 0.5`（**CSS 像素高**），所以
 *   gl_PointSize(物理像素) = size · pixelRatio · (H_css / 2) / depth
 *   ⇒ 屏幕上看到的直径(CSS 像素)  = size · (H_css / 2) / depth
 * 这里**没有** 1/tan(fov/2) 因子 —— 之前按 `fovK = 1/tan(fov/2)` 换算（r160 的 `#passagePx()`）会高估 2.1×，
 * 于是「按 px 反算 size」把点缩到实际 1/2，可读性直接掉档。下限必须按物理像素给：`minPx * pixelRatio`。
 */

const FLOOR_TOKEN = '#include <fog_vertex>';

/** 给一个 Points 材质装上「逐点像素下限」。可重复调用（已装则只更新参数）。 */
export function installPointFloor(material, { minPx = 0 } = {}) {
  let state = material.userData?.pointFloor;
  if (state) { syncPointFloor(state, minPx); return state; }
  state = { minPx, pixelRatio: 1, uniform: { value: 0 } };
  const prevCompile = material.onBeforeCompile;
  const prevCache = typeof material.customProgramCacheKey === 'function' ? material.customProgramCacheKey.bind(material) : null;
  material.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) prevCompile.call(material, shader, renderer);
    shader.uniforms.uPointFloor = state.uniform;
    shader.vertexShader = 'uniform float uPointFloor;\n' + shader.vertexShader
      .replace(FLOOR_TOKEN, FLOOR_TOKEN + '\n\tgl_PointSize = max( gl_PointSize, uPointFloor );');
  };
  // 程序缓存键要把上游的键一起带上，否则两个不同 onBeforeCompile 的材质会共用同一份程序。
  material.customProgramCacheKey = () => `pointfloor|${prevCache ? prevCache() : ''}`;
  material.userData = material.userData || {};
  material.userData.pointFloor = state;
  syncPointFloor(state, minPx);
  return state;
}

/** 同步下限：`minPx` 是 CSS 像素，`pixelRatio` 取 `renderer.getPixelRatio()`。返回实际物理像素下限。 */
export function syncPointFloor(state, minPx = state.minPx, pixelRatio = state.pixelRatio) {
  if (!state) return 0;
  state.minPx = minPx;
  state.pixelRatio = pixelRatio > 0 ? pixelRatio : 1;
  state.uniform.value = Math.max(0, state.minPx * state.pixelRatio);
  return state.uniform.value;
}

/** three 的尺寸公式（CSS 像素）：`size · (H_css / 2) / depth`，再按 `minPx` 托底。 */
export function pointPx(size, depth, heightCss, minPx = 0) {
  const raw = size * (heightCss / 2) / Math.max(1e-3, depth);
  return { raw, px: Math.max(minPx, raw), clamped: raw < minPx };
}
