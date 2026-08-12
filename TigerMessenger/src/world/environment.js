// =====================================================================
//  环境：青绿二次元天空 + 暖日照 + 苔海反光
// =====================================================================
import * as THREE from "three";
import { P } from "../core/params.js";

export function setupEnvironment(scene) {
  // ---------- 光照：暖日光配青绿天光，保持 Cel 色块 ----------
  // 纯白强环境光（默认 1.35）：Cel/Toon 高饱和色块全亮，禁止死黑面
  const ambient = new THREE.AmbientLight(0xffffff, P.ambientIntensity ?? 1.4);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xf0e6e0, 0.72);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, P.sunIntensity ?? 1.6);
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

  const fill = new THREE.DirectionalLight(0x75cfc3, 0.28);
  fill.position.set(-10, 6, -8);
  scene.add(fill);

  // ---------- 天空球：参考图4的青蓝/薄荷双色，并加入漫画式大块云带 ----------
  let skyMat = null; // 昼夜循环要改 uniforms，提到函数作用域
  {
    const skyGeo = new THREE.SphereGeometry(220, 24, 16);
    skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x58b9bd) },
        midColor: { value: new THREE.Color(0x76cdc7) },
        botColor: { value: new THREE.Color(0xa8e1d4) },
        cloudColor: { value: new THREE.Color(0xc2eee0) },
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
        uniform vec3 cloudColor;
        varying vec3 vWorldPos;
        void main() {
          vec3 d = normalize(vWorldPos);
          float h = d.y;
          float lon = atan(d.z, d.x);
          vec3 col = mix(botColor, midColor, smoothstep(-0.35, 0.18, h));
          col = mix(col, topColor, smoothstep(0.08, 0.86, h));

          // 低频宽带 + 高频破边，形成参考图中大片、不规则的薄荷云纹。
          float broad = sin(lon * 1.35 + h * 8.0) + 0.45 * sin(lon * 3.1 - h * 13.0);
          float torn = sin(lon * 7.0 + h * 24.0) * 0.18;
          float cloud = smoothstep(0.48, 0.7, broad * 0.5 + 0.5 + torn);
          cloud *= smoothstep(-0.5, -0.05, h) * (1.0 - smoothstep(0.72, 0.94, h));
          col = mix(col, cloudColor, cloud * 0.58);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    // 城堡区域的天空背景沿 Y 轴再旋转 90°，调整天空纹理/云带的方位。
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.name = "sky-background";
    sky.rotation.y = Math.PI / 2;
    scene.add(sky);
  }

  // ---------- 日轮 ----------
  {
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe6a5 })
    );
    sunDisc.position.set(55, 70, 40);
    scene.add(sunDisc);
    const sunHalo = new THREE.PointLight(0xffe8b0, 0.35, 100, 2);
    sunHalo.position.copy(sunDisc.position);
    scene.add(sunHalo);
  }

  // ---------- 白天氛围：远景飞鸟剪影 + 暖色光尘（替代夜色 lanterns） ----------
  const lanterns = []; // 复用主循环 updateLanterns 驱动
  {
    // 飞鸟：简单 V 字双翼，绕球外圈缓飞
    for (let i = 0; i < 6; i++) {
      const bird = new THREE.Group();
      const wingMat = new THREE.MeshBasicMaterial({
        color: 0x3a4a55,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      });
      const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.12), wingMat);
      wingL.position.set(-0.22, 0, 0);
      wingL.rotation.z = 0.35;
      const wingR = wingL.clone();
      wingR.position.x = 0.22;
      wingR.rotation.z = -0.35;
      bird.add(wingL, wingR);
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0x2a3844, transparent: true, opacity: 0.6 })
      );
      bird.add(body);
      const ang = (i / 6) * Math.PI * 2;
      const elev = 0.35 + (i % 3) * 0.08;
      const rr = 52 + (i % 3) * 4;
      const base = new THREE.Vector3(
        Math.cos(ang) * Math.cos(elev) * rr,
        Math.sin(elev) * rr + 12,
        Math.sin(ang) * Math.cos(elev) * rr
      );
      bird.position.copy(base);
      bird.userData = {
        base: base.clone(),
        phase: Math.random() * Math.PI * 2,
        amp: 0.8,
        speed: 0.25 + Math.random() * 0.15,
        kind: "bird",
        wingL,
        wingR,
      };
      scene.add(bird);
      lanterns.push(bird);
    }
    // 光尘：暖白小点，近地面空气感
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 + Math.random() * 0.04, 5, 4),
        new THREE.MeshBasicMaterial({
          color: 0xfff6e0,
          transparent: true,
          opacity: 0.35,
        })
      );
      const ang = Math.random() * Math.PI * 2;
      const elev = 0.15 + Math.random() * 0.45;
      const rr = 44 + Math.random() * 14;
      const base = new THREE.Vector3(
        Math.cos(ang) * Math.cos(elev) * rr,
        Math.sin(elev) * rr + 6,
        Math.sin(ang) * Math.cos(elev) * rr
      );
      m.position.copy(base);
      m.userData = {
        base: base.clone(),
        phase: Math.random() * Math.PI * 2,
        amp: 0.35 + Math.random() * 0.4,
        speed: 0.35 + Math.random() * 0.4,
        kind: "dust",
      };
      scene.add(m);
      lanterns.push(m);
    }
  }

  return { lanterns, ambient, sun: dir, skyMat, hemi };
}

/** 白天飞鸟 / 光尘动画 */
export function updateLanterns(lanterns, t) {
  if (!lanterns || !lanterns.length) return;
  for (const m of lanterns) {
    const ud = m.userData || {};
    const { base, phase = 0, amp = 0.4, speed = 0.5, kind } = ud;
    if (!base) continue;
    if (kind === "bird") {
      // 缓慢绕极漂移 + 振翅
      const yaw = t * speed * 0.35 + phase;
      m.position.set(
        base.x * Math.cos(yaw * 0.15) - base.z * Math.sin(yaw * 0.15),
        base.y + Math.sin(t * speed + phase) * amp,
        base.x * Math.sin(yaw * 0.15) + base.z * Math.cos(yaw * 0.15)
      );
      if (ud.wingL && ud.wingR) {
        const flap = Math.sin(t * 8 + phase) * 0.45;
        ud.wingL.rotation.z = 0.35 + flap;
        ud.wingR.rotation.z = -0.35 - flap;
      }
    } else {
      m.position.y = base.y + Math.sin(t * speed + phase) * amp;
      m.position.x = base.x + Math.cos(t * speed * 0.6 + phase) * amp * 0.35;
      m.position.z = base.z + Math.sin(t * speed * 0.5 + phase * 1.3) * amp * 0.35;
      if (m.material) {
        m.material.opacity = 0.22 + 0.2 * (0.5 + 0.5 * Math.sin(t * speed * 1.2 + phase));
      }
    }
  }
}
