// =====================================================================
//  环境：光照 / 天空球 / 月亮星点 / 漂浮光点（夜色低多边氛围）
// =====================================================================
import * as THREE from "three";

export function setupEnvironment(scene) {
  // ---------- 光照：环境光 + 太阳平行光（带阴影） + 半球光/补光 ----------
  // 弱环境光：全局基础亮度，避免背光面死黑
  const ambient = new THREE.AmbientLight(0x8899bb, 0.22);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x6a8fd4, 0x1a1428, 0.55);
  scene.add(hemi);

  // 太阳平行光：主光源，开启阴影（shadowMap 已在 core/stage.js 开启）
  const dir = new THREE.DirectionalLight(0xc8d8ff, 1.15);
  dir.position.set(12, 22, 8);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 60;
  dir.shadow.camera.left = -25;
  dir.shadow.camera.right = 25;
  dir.shadow.camera.top = 25;
  dir.shadow.camera.bottom = -25;
  dir.shadow.bias = -0.001;
  scene.add(dir);

  const fill = new THREE.DirectionalLight(0x8866cc, 0.25);
  fill.position.set(-10, 6, -8);
  scene.add(fill);

  // ---------- 天空球：竖直渐变（夜色二次元） ----------
  {
    const skyGeo = new THREE.SphereGeometry(120, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x1a2a55) },
        midColor: { value: new THREE.Color(0x0c1428) },
        botColor: { value: new THREE.Color(0x05080f) },
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
    moon.position.set(-28, 38, -40);
    scene.add(moon);
    const moonGlow = new THREE.PointLight(0xb0c8ff, 0.55, 120, 2);
    moonGlow.position.copy(moon.position);
    scene.add(moonGlow);

    const starCount = 500;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 70 + Math.random() * 40;
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
      const base = new THREE.Vector3(
        (Math.random() - 0.5) * 36,
        1.5 + Math.random() * 8,
        (Math.random() - 0.5) * 36
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

  return { lanterns };
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
