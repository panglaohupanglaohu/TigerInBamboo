import * as THREE from 'three';

// 远山：不建模，用贴图解决（2026-11-09 主人要求，目标图 citadel-target-20261024 里海湾后面那几层远山 / 海上孤岛）。
// 做法：一圈「远景剪影环」——程序画的山脊剪影贴图（远、近两层 + 山脊一线暖边）贴在一条环带上，
//   环带始终围着镜头、放在接近远裁面的地方：只画在天空前面，场景里任何东西都会挡住它（等于天空多了一层远山图层）。
//   环带下沿每帧贴在星球真实地平线上（小星球地平线会下沉：dip = acos(R / |镜头|)），山脚坐在海平线上，不悬空。
//   颜色直接取天空当下的颜色（空气透视：越远越淡、越偏天色），所以白天是灰蓝、黄昏跟着蓝调暮色走。
//   只在高山圣城 / 十二门徒一带、镜头离地不太高时出现，按距离渐隐。?farMountains=0 关闭。
function paintRidges(w = 2048, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // 平滑的一维噪声（首尾相接，贴图左右能无缝循环）
  const smooth = (n, amp) => { const k = Array.from({ length: n }, () => rnd() * amp); return (x) => { const f = x * n, i = Math.floor(f), t = f - i, s = t * t * (3 - 2 * t); return k[i % n] * (1 - s) + k[(i + 1) % n] * s; }; };
  const farBase = smooth(9, 1), farDet = smooth(41, 1), nearBase = smooth(7, 1), nearDet = smooth(53, 1), nearCrag = smooth(131, 1), mask = smooth(5, 1);
  const farH = new Float32Array(w), nearH = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const u = x / w;
    // 远层：连绵低矮、起伏缓（目标图远处那条淡紫山影）
    farH[x] = h * (0.16 + 0.22 * farBase(u) + 0.06 * farDet(u));
    // 近层：成团的高山和海上孤岛，中间留出开阔海面
    const group = Math.min(1, Math.max(0, mask(u) - 0.3) / 0.45), peak = Math.pow(nearBase(u), 1.5);
    nearH[x] = group <= 0 ? 0 : h * Math.sqrt(group) * (0.2 + 0.62 * peak + 0.07 * nearDet(u) + 0.035 * nearCrag(u));
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const up = h - 1 - y, i = (y * w + x) * 4;
    const far = THREE.MathUtils.clamp(farH[x] - up + 0.5, 0, 1), near = THREE.MathUtils.clamp(nearH[x] - up + 0.5, 0, 1);
    const rim = near > 0 ? Math.max(0, 1 - (nearH[x] - up) / 5) : 0;   // 山脊顶上一线暖边
    d[i] = far * 255; d[i + 1] = near * 255; d[i + 2] = rim * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4;
  return tex;
}

export function createCitadelFarMountains({ scene, skyMat, getCenters, radius = 161 }) {
  const off = new URLSearchParams(globalThis.location?.search || '').get('farMountains') === '0';
  if (off || !skyMat) return { update() {} };
  const SEG = 256, pos = [], uv = [], idx = [];
  for (let i = 0; i <= SEG; i++) for (const v of [0, 1]) { pos.push(0, 0, 0); uv.push(i / SEG, v); }
  for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const U = skyMat.uniforms;
  const uniforms = {
    uTex: { value: paintRidges() }, uCam: { value: new THREE.Vector3() }, uUp: { value: new THREE.Vector3(0, 1, 0) },
    uEast: { value: new THREE.Vector3(1, 0, 0) }, uNorth: { value: new THREE.Vector3(0, 0, 1) },
    uR: { value: 400 }, uDip: { value: 0 }, uHeight: { value: 0.1 }, uOpacity: { value: 0 },
    // 天空当下的颜色（与天空着色器同一套 uniform 值，输出方式也一致）
    uTop: U.topColor, uMid: U.midColor, uBot: U.botColor, uGlowGold: U.glowGold, uGlow: U.glowAmount,
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, depthTest: true, fog: false, side: THREE.DoubleSide,
    vertexShader: `uniform vec3 uCam,uUp,uEast,uNorth;uniform float uR,uDip,uHeight;varying vec2 vUv;
      void main(){ vUv=uv; float az=uv.x*6.2831853; float el=-uDip-0.003+uv.y*uHeight;
        vec3 dir=cos(el)*(cos(az)*uEast+sin(az)*uNorth)+sin(el)*uUp;
        gl_Position=projectionMatrix*viewMatrix*vec4(uCam+dir*uR,1.0); }`,
    fragmentShader: `uniform sampler2D uTex;uniform vec3 uTop,uMid,uBot,uGlowGold;uniform float uOpacity,uGlow;varying vec2 vUv;
      void main(){ vec3 m=texture2D(uTex,vec2(vUv.x*3.0,vUv.y)).rgb; float a=max(m.r,m.g); if(a<0.01||uOpacity<=0.0) discard;
        vec3 haze=mix(uBot,uMid,0.6);
        vec3 farCol=mix(haze,uTop,0.35)*0.86;                          // 远层：淡，接近天色
        vec3 nearCol=mix(uMid,uTop,0.8)*0.62;                          // 近层：目标图那种灰蓝 / 蓝紫山影
        nearCol=mix(nearCol,haze,0.45*(1.0-smoothstep(0.0,0.5,vUv.y))); // 山脚贴海面处更雾
        vec3 col=mix(farCol,nearCol,m.g);
        col+=uGlowGold*m.b*m.g*(0.12+0.35*uGlow);                     // 山脊一线暖边（黄昏更明显）
        gl_FragColor=vec4(col,a*uOpacity); }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'citadel-far-mountains-backdrop'; mesh.frustumCulled = false; mesh.renderOrder = -1; mesh.raycast = () => {};
  scene.add(mesh);
  const up = new THREE.Vector3(), worldY = new THREE.Vector3(0, 1, 0);
  let weight = 0;
  mesh.onBeforeRender = (_r, _s, camera) => {
    const cam = camera.getWorldPosition(uniforms.uCam.value), dist = cam.length();
    uniforms.uUp.value.copy(cam).normalize();
    uniforms.uEast.value.crossVectors(worldY, uniforms.uUp.value); if (uniforms.uEast.value.lengthSq() < 1e-6) uniforms.uEast.value.set(1, 0, 0);
    uniforms.uEast.value.normalize(); uniforms.uNorth.value.crossVectors(uniforms.uUp.value, uniforms.uEast.value);
    uniforms.uDip.value = dist > radius ? Math.acos(Math.min(1, radius / dist)) : 0;
    uniforms.uR.value = Math.max(60, (camera.far || 500) * 0.9);
    uniforms.uHeight.value = THREE.MathUtils.degToRad(14);
    const altitude = dist - radius, alt = 1 - THREE.MathUtils.smoothstep(altitude, 90, 200);
    uniforms.uOpacity.value = weight * alt;
  };
  return {
    update(cameraPos) {
      up.copy(cameraPos).normalize(); let best = 1e9;
      for (const dir of getCenters() || []) if (dir) best = Math.min(best, up.angleTo(dir) * radius);
      weight = 1 - THREE.MathUtils.smoothstep(best, 140, 260);
      mesh.visible = weight > 0.002;
    },
  };
}
