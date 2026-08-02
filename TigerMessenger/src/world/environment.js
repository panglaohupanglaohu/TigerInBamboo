// =====================================================================
//  环境：日系白天插画风光照 + 薄荷天空 + 轻柔日光点缀
//  （已清除月亮 / 星点 / 夜色漂浮光点）
// =====================================================================
import * as THREE from "three";
import { P } from "../core/params.js";

export function setupEnvironment(scene) {
  // ---------- 光照：清爽高亮 ----------
  const ambient = new THREE.AmbientLight(0xf2fffb, P.ambientIntensity ?? 1.0);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xd6fff2, 0x3d9a5f, 0.5);
  scene.add(hemi);

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

  // ---------- 天空球：薄荷青渐变 ----------
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

  // ---------- 日轮（替代月亮）：远景暖阳圆盘 ----------
  {
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff0c2 })
    );
    sunDisc.position.set(55, 70, 40);
    scene.add(sunDisc);
    const sunHalo = new THREE.PointLight(0xffe8b0, 0.35, 100, 2);
    sunHalo.position.copy(sunDisc.position);
    scene.add(sunHalo);
  }

  // 不再放置星点 / 夜色漂浮光点；lanterns 保留空数组以兼容主循环
  const lanterns = [];

  return { lanterns, ambient, sun: dir };
}

/** 兼容旧 API：无夜色光点时为空操作 */
export function updateLanterns(lanterns, t) {
  if (!lanterns || !lanterns.length) return;
  for (const m of lanterns) {
    const { base, phase, amp, speed } = m.userData || {};
    if (!base) continue;
    m.position.y = base.y + Math.sin(t * speed + phase) * amp;
    m.position.x = base.x + Math.cos(t * speed * 0.6 + phase) * amp * 0.35;
    m.position.z = base.z + Math.sin(t * speed * 0.5 + phase * 1.3) * amp * 0.35;
  }
}
