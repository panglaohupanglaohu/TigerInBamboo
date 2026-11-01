/**
 * outline.js — the edge pass Oskar's clips are built on.
 *
 * All four reference clips share one thing regardless of subject (mesa island,
 * chapel, interior furniture): flat-shaded low-poly surfaces with a thin dark
 * line riding every crease *and* every silhouette. The line is not black — it
 * samples around #193a4a, i.e. the scene's ambient hue pulled dark, which is why
 * it never reads as "comic ink".
 *
 * Implementation: render colour to a target, render normals + depth to a second
 * target, then a fullscreen pass does Sobel on normals and on linear depth and
 * mixes the line into the colour. Depth edges handle silhouettes; normal edges
 * handle creases *inside* a silhouette. Doing only one of the two is the usual
 * reason a hand-rolled outline looks either hollow or like a bad cartoon.
 */

import * as THREE from 'three';

const compositeVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const compositeFrag = /* glsl */ `
precision highp float;

uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform vec3 uLine;
uniform vec3 uGlow;       // warm HDR colour used on upward-facing edges
uniform vec3 uUpVS;       // world up, in view space
uniform float uThickness;
uniform float uStrength;
uniform float uFade;      // 0 = never fade out, 1 = fade steeply with distance

varying vec2 vUv;

float linearDepth(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  float z = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

vec3 normalAt(vec2 uv) {
  return normalize(texture2D(tNormal, uv).xyz * 2.0 - 1.0);
}

void main() {
  vec2 texel = uThickness / uResolution;

  // ---- depth edges: silhouettes and hard steps -------------------------
  float c = linearDepth(vUv);
  float dz = 0.0;
  dz = max(dz, abs(linearDepth(vUv + vec2(texel.x, 0.0)) - c));
  dz = max(dz, abs(linearDepth(vUv - vec2(texel.x, 0.0)) - c));
  dz = max(dz, abs(linearDepth(vUv + vec2(0.0, texel.y)) - c));
  dz = max(dz, abs(linearDepth(vUv - vec2(0.0, texel.y)) - c));
  dz = max(dz, abs(linearDepth(vUv + texel) - c));
  dz = max(dz, abs(linearDepth(vUv - texel) - c));
  // relative to the pixel's own depth, so far geometry does not turn solid line
  float depthEdge = smoothstep(0.03, 0.13, dz / max(c, 0.001));

  // ---- normal edges: creases within one surface ------------------------
  vec3 n = normalAt(vUv);
  float nd = 0.0;
  nd = max(nd, 1.0 - dot(n, normalAt(vUv + vec2(texel.x, 0.0))));
  nd = max(nd, 1.0 - dot(n, normalAt(vUv - vec2(texel.x, 0.0))));
  nd = max(nd, 1.0 - dot(n, normalAt(vUv + vec2(0.0, texel.y))));
  nd = max(nd, 1.0 - dot(n, normalAt(vUv - vec2(0.0, texel.y))));
  float normalEdge = smoothstep(0.55, 0.98, nd);

  float edge = clamp(max(depthEdge, normalEdge), 0.0, 1.0);

  // Sampling past the frame edge returns zero depth, which paints a line along
  // the border of the window; fade the effect out in the outer two pixels.
  vec2 edgeDist = min(vUv, 1.0 - vUv) * uResolution;
  edge *= smoothstep(0.0, 2.0, min(edgeDist.x, edgeDist.y));
  edge *= mix(1.0, 0.55, clamp(c / (uFar * 0.45), 0.0, 1.0) * uFade);

  vec3 col = texture2D(tColor, vUv).xyz;

  // Upward-facing edges are not ink: in the reference they carry a warm amber
  // rim, brightest along every plateau lip. Deciding it here, from the normal
  // buffer, is why no extra geometry is needed for the glow.
  float up = dot(n, normalize(uUpVS));

  // Amber rim light only belongs on the terrain. A near-white object that sits
  // on top of the land (birds, gulls) would otherwise get an orange contour
  // instead of the thin dark line the reference draws on them.
  vec3 under = texture2D(tColor, vUv).xyz;
  float bright = dot(under, vec3(0.299, 0.587, 0.114));
  float glowAllowed = 1.0 - smoothstep(0.72, 0.90, bright);
  // Only edges that actually step in depth get the glow. Creases inside one
  // surface (roof courses, wall joints) stay ink — otherwise every tile seam
  // lights up and the roof turns into an orange wireframe.
  float rim = smoothstep(0.36, 0.88, up) * smoothstep(0.55, 1.0, depthEdge) * glowAllowed;

  // keep a little of the surface in the ink, the way ink over gouache does
  vec3 line = mix(uLine, col * 0.32, 0.18);
  vec3 lineColour = mix(line, uGlow, rim);
  col = mix(col, lineColour, edge * uStrength * mix(1.0, 1.15, rim));

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class OutlinePass {
  constructor(renderer, {
    color = '#16242c',
    glow = '#ffb45e',
    thickness = 1.0,
    strength = 1.0,
    fade = 0.65,
  } = {}) {
    this.renderer = renderer;
    this.thickness = thickness;
    this.strength = strength;
    this.fade = fade;
    this.lineColor = new THREE.Color(color).convertSRGBToLinear();

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());

    this.colorTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.colorTarget.depthTexture = new THREE.DepthTexture(size.x, size.y);
    this.colorTarget.depthTexture.type = THREE.UnsignedIntType;

    this.normalTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });

    this.uniforms = {
      tColor: { value: this.colorTarget.texture },
      tNormal: { value: this.normalTarget.texture },
      tDepth: { value: this.colorTarget.depthTexture },
      uResolution: { value: new THREE.Vector2(size.x, size.y) },
      uNear: { value: 0.1 },
      uFar: { value: 500 },
      uLine: { value: this.lineColor },
      uGlow: { value: new THREE.Color(glow).convertSRGBToLinear().multiplyScalar(1.75) },
      uUpVS: { value: new THREE.Vector3(0, 1, 0) },
      uThickness: { value: this.thickness },
      uStrength: { value: this.strength },
      uFade: { value: this.fade },
    };

    const quad = new THREE.BufferGeometry();
    quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    quad.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: compositeVert,
      fragmentShader: compositeFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.quadScene = new THREE.Scene();
    this.quadScene.add(new THREE.Mesh(quad, this.material));
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // normal material for the geometry pass; overridden material ignores lights
    this.normalMaterial = new THREE.MeshNormalMaterial({ flatShading: false });
  }

  setSize(width, height) {
    const dpr = this.renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    this.colorTarget.setSize(w, h);
    this.colorTarget.depthTexture.image.width = w;
    this.colorTarget.depthTexture.image.height = h;
    this.colorTarget.depthTexture.needsUpdate = true;
    this.normalTarget.setSize(w, h);
    this.uniforms.uResolution.value.set(w, h);
  }

  /** Renders `scene` with outlines. Sky/background is taken from scene.background. */
  render(scene, camera) {
    const renderer = this.renderer;
    const prevTarget = renderer.getRenderTarget();
    const prevOverride = scene.overrideMaterial;

    this.uniforms.uNear.value = camera.near;
    this.uniforms.uFar.value = camera.far;
    // world up expressed in view space, so the normal buffer can be tested
    // against "does this edge look upward" without a second render target
    this.uniforms.uUpVS.value.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);

    // pass 1 — colour + depth
    renderer.setRenderTarget(this.colorTarget);
    renderer.clear();
    renderer.render(scene, camera);

    // pass 2 — view-space normals. Overlay-only meshes (the backlit hull) are
    // hidden: they are a light effect, and letting them into the normal buffer
    // draws edges around a shell that is not really there.
    const hidden = [];
    scene.traverse((o) => {
      if (o.userData && o.userData.overlayOnly && o.visible) { o.visible = false; hidden.push(o); }
    });
    scene.overrideMaterial = this.normalMaterial;
    renderer.setRenderTarget(this.normalTarget);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = prevOverride;
    for (const o of hidden) o.visible = true;

    // pass 3 — composite to screen
    renderer.setRenderTarget(prevTarget);
    renderer.render(this.quadScene, this.quadCamera);
  }
}
