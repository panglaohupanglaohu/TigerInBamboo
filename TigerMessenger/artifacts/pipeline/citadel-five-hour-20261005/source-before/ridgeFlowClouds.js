import * as THREE from 'three';
import {buildRidgeCloudField} from './ridgeCloudField.js';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';

// =====================================================================
// Project-authored holy-city terrain-flow clouds (user 2026-09-25: "clouds slowly flowing along
// the ridges"). Mist puffs use a refreshed final-mesh cache, then drift with a gentle west wind along the ridge
// and spill down the lee slope, hugging the ground, growing and fading. They
// dissolve over built districts and open sea, so the cities stay clear.
// One instanced draw call of soft camera-facing sprites, tinted by the sky.
// =====================================================================

const COUNT = 384;
const WIND = new THREE.Vector2(0.94, 0.34).normalize().multiplyScalar(0.85); // m/s, castle-local x/z
const SLOPE_PULL = 0.55;      // gentle lee-side spill per unit gradient
const ALONG = 0.9;            // share of wind redirected along the contour (ridge-following)
const MIN_SPEED = 0.35, MAX_SPEED = 1.5;

export function ridgeCloudFrameMatrix(castle,mesh){
 castle.updateWorldMatrix(true,false);mesh.updateWorldMatrix(true,false);
 return mesh.matrixWorld.clone().invert().multiply(castle.matrixWorld);
}

export function refreshRidgeFlowClouds(castle,{surfaces=[],rail=[],protectedBoxes=[],radius=160}={}){
 const mesh=castle.userData.ridgeFlowClouds;if(!mesh?.userData.refresh)return null;
 castle.updateWorldMatrix(true,true);const inverse=castle.matrixWorld.clone().invert(),ray=new THREE.Raycaster();ray.layers.enableAll();
 const down=new THREE.Vector3(0,-1,0).transformDirection(castle.matrixWorld),p=new THREE.Vector3();
 const boxes=surfaces.map(o=>({o,box:new THREE.Box3().setFromObject(o)}));
 const field=buildRidgeCloudField((x,z)=>{
  p.set(x,160,z).applyMatrix4(castle.matrixWorld);ray.set(p,down);ray.far=360;
  const hit=ray.intersectObjects(boxes.filter(b=>ray.ray.intersectsBox(b.box)).map(b=>b.o),false)[0];if(!hit)return null;
  const world=hit.point,local=world.clone().applyMatrix4(inverse),dry=world.length()-radius-officialOceanLevelAt(world)>2;
  // Sprite extent and interpolation footprint are included, not just its centre.
  const allowed=dry&&rail.every(q=>q.distanceToSquared(world)>32*32)&&protectedBoxes.every(b=>b.distanceToPoint(world)>22);
  return {height:local.y,allowed};
 });
 mesh.userData.refresh(field);return field.stats;
}

export function puffTexture() {
  const size = 128, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  // A few overlapping soft lobes read as a cloud tuft rather than a disc.
  const lobes = [[.5, .55, .42, 1], [.34, .5, .26, .8], [.66, .48, .28, .8], [.46, .38, .24, .7], [.6, .64, .22, .6]];
  for (const [cx, cy, r, a] of lobes) {
    const grd = g.createRadialGradient(cx * size, cy * size, 0, cx * size, cy * size, r * size);
    grd.addColorStop(0, `rgba(255,255,255,${.55 * a})`);
    grd.addColorStop(.55, `rgba(255,255,255,${.28 * a})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function mountRidgeFlowClouds(castle, {radius = 160, timeOfDay = () => 0.5} = {}) {
  if (!castle || typeof document === 'undefined') return null;
  if (new URLSearchParams(globalThis.location?.search || '').get('citadelRidgeClouds') === '0') return null;
  let S = null;
  // Planet centre in castle-local space: radial "up" at any local point.
  // (recomputed each frame: the castle is re-seated after load by the common frame)
  const centre = new THREE.Vector3();
  const _p = new THREE.Vector3();
  const localPoint = (x,z,height,lift,out) => {out.set(x,height,z);return out.addScaledVector(out.clone().sub(centre).normalize(),lift);};

  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index; geo.setAttribute('position', quad.getAttribute('position')); geo.setAttribute('uv', quad.getAttribute('uv'));
  geo.instanceCount = COUNT;
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const iSize = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1).setUsage(THREE.DynamicDrawUsage);
  const iAlpha = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1).setUsage(THREE.DynamicDrawUsage);
  const iRot = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1);
  geo.setAttribute('iPos', iPos); geo.setAttribute('iSize', iSize); geo.setAttribute('iAlpha', iAlpha); geo.setAttribute('iRot', iRot);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {map: {value: puffTexture()}, uTint: {value: new THREE.Color(1, 1, 1)}, uShade: {value: new THREE.Color(0.74, 0.8, 0.86)}, uOpacity: {value: 1}},
    vertexShader: `
      attribute vec3 iPos; attribute float iSize; attribute float iAlpha; attribute float iRot;
      varying vec2 vUv; varying float vAlpha;
      void main(){
        vUv = uv; vAlpha = iAlpha;
        vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
        float c = cos(iRot), s = sin(iRot);
        vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
        mv.xy += q * vec2(iSize * 1.35, iSize * 0.8);   // wider than tall: lying mist
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec3 uTint; uniform vec3 uShade; uniform float uOpacity;
      varying vec2 vUv; varying float vAlpha;
      void main(){
        vec4 t = texture2D(map, vUv);
        float a = t.a * vAlpha * uOpacity;
        if (a < 0.004) discard;
        vec3 col = mix(uShade, vec3(1.0), smoothstep(0.15, 0.85, vUv.y)) * uTint;
        gl_FragColor = vec4(col, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'citadel-ridge-flow-clouds';
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  castle.add(mesh);mesh.visible=false;

  // Particle state.
  const px = new Float32Array(COUNT), pz = new Float32Array(COUNT), age = new Float32Array(COUNT), life = new Float32Array(COUNT), size = new Float32Array(COUNT), base = new Float32Array(COUNT), clear = new Float32Array(COUNT);
  let seed = 0x5eed1234 >>> 0;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const spawn = (i, prewarmAge = 0) => {
    if(!S?.crests.length)return;
    let r = rnd() * S.total, c = S.crests[0];
    for (const k of S.crests) { r -= k.w; if (r <= 0) { c = k; break; } }
    px[i] = c.x + (rnd() - .5) * 3; pz[i] = c.z + (rnd() - .5) * 3;
    life[i] = 40 + rnd() * 30; age[i] = prewarmAge;
    size[i] = 5 + rnd() * 4; base[i] = .18 + rnd() * .12; clear[i] = .4 + rnd() * 1.0;
    iRot.array[i] = rnd() * Math.PI * 2;
  };
  const step = (i, dt) => {
    const [gx, gz] = S.grad(px[i], pz[i]);
    // Contour direction (perpendicular to the gradient), oriented with the wind:
    // puffs slide along the ridge line, with a gentle spill down the lee side.
    const g = Math.hypot(gx, gz);
    let cx = 0, cz = 0;
    if (g > 1e-4) { cx = -gz / g; cz = gx / g; if (cx * WIND.x + cz * WIND.y < 0) { cx = -cx; cz = -cz; } }
    const w = WIND.length();
    let vx = cx * w * ALONG + WIND.x * (1 - ALONG) + WIND.x * 0.25 - gx * SLOPE_PULL;
    let vz = cz * w * ALONG + WIND.y * (1 - ALONG) + WIND.y * 0.25 - gz * SLOPE_PULL;
    const sp = Math.hypot(vx, vz) || 1, k = Math.min(MAX_SPEED, Math.max(MIN_SPEED, sp)) / sp;
    vx *= k; vz *= k;
    px[i] += vx * dt; pz[i] += vz * dt; age[i] += dt;
    const kd = S.kind(px[i], pz[i]);
    if ((kd !== 1) && life[i] - age[i] > 3) life[i] = age[i] + 3;  // dissolve over cities / sea
    if (age[i] >= life[i]) spawn(i);
  };
  mesh.userData.refresh=field=>{
    S=field;mesh.visible=S.crests.length>0;
    for(let i=0;i<COUNT;i++)spawn(i,0);
    if(mesh.visible)for(let s=0;s<30;s++)for(let i=0;i<COUNT;i++)step(i,.5);
    iRot.needsUpdate=true;
    mesh.userData.stats={particles:COUNT,spawnCells:S.crests.length,...S.stats,spawnBounds:S.crests.length?{minX:Math.min(...S.crests.map(c=>c.x)),maxX:Math.max(...S.crests.map(c=>c.x)),minZ:Math.min(...S.crests.map(c=>c.z)),maxZ:Math.max(...S.crests.map(c=>c.z))}:null,source:'final rendered rock surfaces',method:'cached terrain field and wind advection; project shader'};
  };

  const sky = () => castle.parent && (castle.userData._skyMesh ||= (() => { let r = null; let o = castle; while (o.parent) o = o.parent; o.traverse(m => { if (!r && m.name === 'sky-background') r = m; }); return r; })());
  let lastT = null;
  const update = (t) => {
    if(!S?.crests.length)return;
    const time = Number(t) || 0;
    const dt = lastT == null ? 0 : Math.min(0.1, Math.max(0, time - lastT));
    lastT = time;
    castle.updateWorldMatrix(true, false);
    castle.worldToLocal(centre.set(0, 0, 0));
    const cloudFromCastle=ridgeCloudFrameMatrix(castle,mesh);
    let active=0,unsupported=0,alphaSum=0;
    for (let i = 0; i < COUNT; i++) {
      if (dt > 0) step(i, dt);
      const u = age[i] / life[i];
      const grow = size[i] * (0.75 + 0.6 * u);
      const sampled=S.height(px[i],pz[i]),allowed=Number.isFinite(sampled);
      // Conservative cache-corner envelope, not an exact sub-cell surface.
      const ground=allowed?S.clearanceHeight(px[i],pz[i]):0;
      localPoint(px[i],pz[i],ground,clear[i]+grow*.25,_p);
      _p.applyMatrix4(cloudFromCastle);
      iPos.array[i * 3] = _p.x; iPos.array[i * 3 + 1] = _p.y; iPos.array[i * 3 + 2] = _p.z;
      iSize.array[i] = grow;
      const fadeIn = Math.min(1, age[i] / 5), fadeOut = Math.min(1, (life[i] - age[i]) / 9);
      iAlpha.array[i] = allowed?base[i]*fadeIn*fadeOut:0;
      if(!allowed)unsupported++;if(iAlpha.array[i]>.01)active++;alphaSum+=iAlpha.array[i];
    }
    Object.assign(mesh.userData.stats,{active,unsupported,alphaSum});
    iPos.needsUpdate = iSize.needsUpdate = iAlpha.needsUpdate = true;
    // Tint follows the sky's cloud colour (dawn/dusk warmth); thinner at night.
    const skyMesh = sky();
    const cc = skyMesh?.material?.uniforms?.cloudColor?.value;
    if (cc) material.uniforms.uTint.value.copy(cc).lerp(new THREE.Color(1, 1, 1), 0.45);
    const tod = ((Number(timeOfDay()) || 0.5) % 1 + 1) % 1;
    const night = THREE.MathUtils.smoothstep(Math.abs(tod - 0.5), 0.3, 0.42);
    material.uniforms.uOpacity.value = 1 - 0.6 * night;
  };
  update(0);
  mesh.userData.update = update;
  mesh.userData.stats = {particles:COUNT,spawnCells:0,waitingForFinalSurface:true};
  castle.userData.ridgeFlowClouds = mesh;
  return mesh;
}
