// =====================================================================
//  环境：光照 / 天空球 / 月亮星点 / 漂浮光点（夜色低多边氛围）
// =====================================================================
import * as THREE from "three";

import { P } from "../core/params.js";

export function setupEnvironment(scene) {
  // ---------- 光照：日系白天插画风（清爽高亮，杜绝死黑） ----------
  // 强环境光：极浅青白色，暗部也保持干净
  const ambient = new THREE.AmbientLight(0xf2fffb, P.ambientIntensity ?? 1.0);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xd6fff2, 0x3d9a5f, 0.5);
  scene.add(hemi);

  // 太阳平行光：从侧上方斜射向球心，硬边定型投影
  const dir = new THREE.DirectionalLight(0xfff6e0, P.sunIntensity ?? 1.6);
  dir.position.set(20, 28, 16);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 90;
  dir.shadow.camera.left = -25;
  dir.shadow.camera.right = 25;
  dir.shadow.camera.top = 25;
  dir.shadow.camera.bottom = -25;
  dir.shadow.bias = -0.001;
  scene.add(dir);

  const fill = new THREE.DirectionalLight(0xbfe8ff, 0.2);
  fill.position.set(-10, 6, -8);
  scene.add(fill);

  // ---------- 天空球：薄荷青渐变（与背景同族，略带地平线层次） ----------
  {
    const skyGeo = new THREE.SphereGeometry(220, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x6ac7b9) },
        midColor: { value: new THREE.Color(0x79d2c4) },
        botColor: { value: new THREE.Color(0x8fe0d2) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 botColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          vec3 col = mix(botColor, midColor, smoothstep(-0.2, 0.25, h));
          col = mix(col, topColor, smoothstep(0.15, 0.85, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));
  }

  // ---------- 月亮 + 星点 ----------
  {
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xd8e6ff })
    );
    moon.position.set(-60, 90, -80);
    scene.add(moon);
    const moonGlow = new THREE.PointLight(0xb0c8ff, 0.55, 120, 2);
    moonGlow.position.copy(moon.position);
    scene.add(moonGlow);

    const starCount = 500;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 140 + Math.random() * 60;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.05 + Math.random() * 0.85);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xc8d8ff,
      size: 0.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })));
  }

  // ---------- 漂浮光点（二次元夜色氛围） ----------
  const lanterns = [];
  {
    const n = 28;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 6, 4),
        new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? 0xffe08a : i % 3 === 1 ? 0x9ec5ff : 0xc9a8ff,
          transparent: true,
          opacity: 0.75,
        })
      );
      // 球外附近漂浮，围绕赤道带
      const ang = Math.random() * Math.PI * 2;
      const elev = (Math.random() - 0.3) * 0.8;
      const rr = 42 + Math.random() * 18;
      const base = new THREE.Vector3(
        Math.cos(ang) * Math.cos(elev) * rr,
        Math.sin(elev) * rr + 8,
        Math.sin(ang) * Math.cos(elev) * rr
      );
      m.position.copy(base);
      m.userData = {
        base,
        phase: Math.random() * Math.PI * 2,
        amp: 0.4 + Math.random() * 0.6,
        speed: 0.4 + Math.random() * 0.6,
      };
      scene.add(m);
      lanterns.push(m);
    }
  }

  return { lanterns, ambient, sun: dir };
}

/** 每帧推进漂浮光点 */
export function updateLanterns(lanterns, t) {
  for (const m of lanterns) {
    const { base, phase, amp, speed } = m.userData;
    m.position.y = base.y + Math.sin(t * speed + phase) * amp;
    m.position.x = base.x + Math.cos(t * speed * 0.6 + phase) * amp * 0.35;
    m.position.z = base.z + Math.sin(t * speed * 0.5 + phase * 1.3) * amp * 0.35;
    if (m.material) {
      m.material.opacity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(t * speed * 1.4 + phase));
    }
  }
}
