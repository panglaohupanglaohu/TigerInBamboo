/**
 * Island snapshot — render the island into a 64×64 texture and crisp it back up.
 *
 * Reference (2017-09-24): "I'm looking at the campaign map. Saving island
 * snapshots to 64² textures and then crisping them back up with some shader
 * magic."
 *
 * Why 64²: a campaign map shows dozens of islands at once. At thumbnail size the
 * full mesh is pure waste, so the island is baked once into a tiny render target
 * and the map only ever draws quads.
 *
 * Why "crisping": 64×64 upscaled with bilinear filtering turns every coastline
 * into mush. The trick is an unsharp mask on the magnified image, which restores
 * the hard silhouette without adding texels. That filter is the "shader magic" —
 * here it runs on the CPU because a 64×64 pass costs 4096 pixels and does not
 * justify another render target; the arithmetic is identical.
 */

import * as THREE from 'three';

const SRGB_TO_LINEAR = (u) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));

export function createIslandSnapshot(renderer, scene, { size = 64, upscale = 3 } = {}) {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });
  rt.texture.colorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const centre = new THREE.Vector3();
  const buffer = new Uint8Array(size * size * 4);

  /**
   * Render the island from straight above into the render target.
   * `half` is the half-width of the square that covers the island.
   */
  function capture({ half = 10, height = 40, hide = [] } = {}) {
    const restore = hide.filter(Boolean).map((o) => [o, o.visible]);
    for (const [o] of restore) o.visible = false;

    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();

    camera.left = -half;
    camera.right = half;
    camera.top = half;
    camera.bottom = -half;
    camera.position.set(centre.x, height, centre.z);
    camera.up.set(0, 0, -1);
    camera.lookAt(centre.x, 0, centre.z);
    camera.updateProjectionMatrix();

    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buffer);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevAlpha);

    for (const [o, vis] of restore) o.visible = vis;

    return buffer;
  }

  /**
   * Unsharp mask: out = centre * (1 + amount) - blur(centre) * amount.
   * A 4-neighbour average is the blur, which is enough at this size.
   * Alpha is treated the same way so the silhouette edge hardens too.
   */
  function crisp(src, amount = 1.5) {
    const out = new Uint8ClampedArray(src.length);
    const at = (x, y) => (y * size + x) * 4;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = at(x, y);
        for (let c = 0; c < 4; c++) {
          const v = src[i + c];
          let sum = 0;
          let n = 0;
          if (x > 0) { sum += src[at(x - 1, y) + c]; n++; }
          if (x < size - 1) { sum += src[at(x + 1, y) + c]; n++; }
          if (y > 0) { sum += src[at(x, y - 1) + c]; n++; }
          if (y < size - 1) { sum += src[at(x, y + 1) + c]; n++; }
          const blur = sum / Math.max(1, n);
          out[i + c] = v * (1 + amount) - blur * amount;
        }
      }
    }
    return out;
  }

  /** WebGL reads bottom-up, so flip while copying into the canvas. */
  function toCanvas(pixels, scale = upscale) {
    const small = document.createElement('canvas');
    small.width = size;
    small.height = size;
    const sctx = small.getContext('2d');
    const img = sctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      const srcRow = (size - 1 - y) * size * 4;
      img.data.set(pixels.subarray(srcRow, srcRow + size * 4), y * size * 4);
    }
    sctx.putImageData(img, 0, 0);

    const big = document.createElement('canvas');
    big.width = size * scale;
    big.height = size * scale;
    const bctx = big.getContext('2d');
    bctx.imageSmoothingEnabled = true;
    bctx.imageSmoothingQuality = 'high';
    bctx.drawImage(small, 0, 0, big.width, big.height);
    return big;
  }

  return {
    target: rt,
    setCentre(x, z) { centre.set(x, 0, z); },
    /** Full pipeline: render → read → unsharp → upscale. Returns a canvas. */
    shoot(opts) {
      const raw = capture(opts);
      const sharp = crisp(raw, opts?.amount ?? 1.5);
      const canvas = toCanvas(sharp);
      return { canvas, dataUrl: canvas.toDataURL('image/png') };
    },
    dispose() { rt.dispose(); },
  };
}
