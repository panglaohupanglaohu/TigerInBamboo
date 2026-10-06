import {targetCityParams} from './citadel/targetCityRelease.js';
// =====================================================================
//  环境：青绿二次元天空 + 暖日照 + 苔海反光
// =====================================================================
import * as THREE from "three";
import { P } from "../core/params.js";
import { registerLocalLight } from "../render/lighting/localLightRegistry.js";

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
    const skyGeo = new THREE.SphereGeometry(2000, 48, 32);
    skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x58b9bd) },
        midColor: { value: new THREE.Color(0x76cdc7) },
        botColor: { value: new THREE.Color(0xa8e1d4) },
        cloudColor: { value: new THREE.Color(0xc2eee0) },
        holyDayBlend: { value: 0 },
        citadelTargetStyle: { value: targetCityParams().get('citadelTargetAtmosphere')==='1'?1:0 },
        citadelBlend: { value: 0 },
        citadelUp: { value: new THREE.Vector3(0,1,0) },
        moebiusV10Blend: { value: 0 },
        moebiusV10Up: { value: new THREE.Vector3(0,-1,0) },
        moebiusV10Day: { value: 1 },
        // 朝霞/暮云霞光（2026-09-24）：按相机局部天顶与虚拟日向计算，任何经纬都贴地平线
        localUp: { value: new THREE.Vector3(0,1,0) },
        glowSunDir: { value: new THREE.Vector3(1,0,0) },
        glowAmount: { value: 0 },
        glowGold: { value: new THREE.Color(0xffc46e) },
        glowRose: { value: new THREE.Color(0xff7a8a) },
        glowViolet: { value: new THREE.Color(0x7a5fa8) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          // Keep the sky behind the scene even with the gameplay camera's 500 m far clip.
          gl_Position.z = gl_Position.w * .9999;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 botColor;
        uniform vec3 cloudColor;
        uniform float holyDayBlend;
        uniform float citadelTargetStyle;
        uniform float citadelBlend;
        uniform vec3 citadelUp;
        uniform float moebiusV10Blend;
        uniform vec3 moebiusV10Up;
        uniform float moebiusV10Day;
        uniform vec3 localUp;
        uniform vec3 glowSunDir;
        uniform float glowAmount;
        uniform vec3 glowGold;
        uniform vec3 glowRose;
        uniform vec3 glowViolet;
        varying vec3 vWorldPos;
        void main() {
          vec3 d = normalize(vWorldPos);
          float h = d.y;
          float lon = atan(d.z, d.x);
          vec3 col = mix(botColor, midColor, smoothstep(-0.35, 0.18, h));
          col = mix(col, topColor, smoothstep(0.08, 0.86, h));

          // 低频宽带 + 高频破边，形成参考图中大片、不规则的薄荷云纹。
          // 经度方向的频率必须是整数：atan 在 ±π 处回绕，非整数频率会留下一条笔直接缝
          float broad = sin(lon * 1.0 + h * 8.0) + 0.45 * sin(lon * 3.0 - h * 13.0);
          float torn = sin(lon * 7.0 + h * 24.0) * 0.18;
          float cloud = smoothstep(0.48, 0.7, broad * 0.5 + 0.5 + torn);
          cloud *= smoothstep(-0.5, -0.05, h) * (1.0 - smoothstep(0.72, 0.94, h));
          col = mix(col, cloudColor, cloud * 0.58);
          float localH=dot(normalize(vWorldPos-cameraPosition),citadelUp);
          vec3 gorgeSky=mix(vec3(.035,.18,.39),vec3(.035,.40,.68),smoothstep(-.15,.55,localH));
          col=mix(col,gorgeSky,citadelBlend);
          float crystalH=dot(normalize(vWorldPos-cameraPosition),moebiusV10Up);
          vec3 crystalSky=mix(vec3(.52,.76,.83),vec3(.13,.48,.73),smoothstep(-.12,.9,crystalH));
          crystalSky*=mix(.24,1.0,moebiusV10Day);
          col=mix(col,crystalSky,moebiusV10Blend);
          vec3 holySky=mix(vec3(.72,.84,.88),vec3(.29,.59,.80),smoothstep(-.12,.72,localH));
          float holyCloud=smoothstep(.68,.91,sin(lon*4.+localH*16.)*.28+sin(lon*8.-localH*23.)*.15+.5)*(1.-smoothstep(.5,.8,localH));
          holySky=mix(holySky,vec3(.94,.94,.89),holyCloud*.8);
          vec3 targetSky=mix(vec3(.56,.83,.97),vec3(.37,.69,.91),smoothstep(-.10,.55,localH));
          holySky=mix(holySky,targetSky,citadelTargetStyle);
          col=mix(col,holySky,holyDayBlend);
          // ---- 霞光：地平线暖带 + 日侧光晕 + 云缘镶金 + 天顶紫晕 ----
          if (glowAmount > 0.001) {
            vec3 v = normalize(vWorldPos - cameraPosition);
            float gh = dot(v, localUp);
            vec3 flatV = v - localUp * gh;
            vec3 sunFlat = glowSunDir - localUp * dot(glowSunDir, localUp);
            float facing = dot(normalize(flatV + 1e-5), normalize(sunFlat + 1e-5)) * 0.5 + 0.5;
            float sunSide = facing * facing;
            float band = exp(-pow((gh - 0.03) / 0.15, 2.0));
            float lowBand = exp(-pow((gh + 0.02) / 0.07, 2.0));
            vec3 horizon = mix(glowRose, glowGold, sunSide);
            col = mix(col, horizon, clamp(glowAmount * band * (0.14 + 0.46 * sunSide), 0.0, 0.55));
            col += glowGold * glowAmount * lowBand * sunSide * 0.16;
            float halo = max(dot(v, normalize(glowSunDir)), 0.0);
            col += glowGold * glowAmount * (pow(halo, 14.0) * 0.22 + pow(halo, 140.0) * 0.55);
            // 高空侧光把云带边缘染成金红（霞光闪耀）
            float rim = cloud * (0.35 + 0.65 * sunSide) * smoothstep(-0.2, 0.45, gh);
            col = mix(col, mix(glowRose, glowGold, sunSide) * 1.12, clamp(rim * sunSide * glowAmount * 0.5, 0.0, 0.42));
            // 背日侧天顶泛紫，拉开冷暖
            col = mix(col, glowViolet, glowAmount * (0.3 + 0.22 * (1.0 - sunSide)) * smoothstep(0.08, 0.75, gh));
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    // 城堡区域的天空背景沿 Y 轴再旋转 90°，调整天空纹理/云带的方位。
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.name = "sky-background";
    sky.rotation.y = Math.PI / 2;
    sky.frustumCulled=false;
    const anchor=new THREE.Vector3();
    const targetFog=new THREE.Color(0xb5d9e6),legacyFogDensity=scene.fog?.density;
    const _east=new THREE.Vector3(),_worldY=new THREE.Vector3(0,1,0);
    sky.onBeforeRender=(_r,_s,camera)=>{
      // 霞光时段：朝霞 t≈0.285、暮云 t≈0.765（与 dayNight 关键帧对齐），余晖到 0.8
      const tod=((P.timeOfDay??.5)%1+1)%1;
      const bell=(c,w)=>{const u=1-THREE.MathUtils.clamp(Math.abs(tod-c)/w,0,1);return u*u*(3-2*u);};
      const dawnG=bell(.285,.065),duskG=bell(.77,.075),glow=Math.max(dawnG,duskG);
      const U=skyMat.uniforms;
      U.glowAmount.value=glow;
      U.localUp.value.copy(camera.position).normalize();
      _east.crossVectors(_worldY,U.localUp.value);
      if(_east.lengthSq()<1e-6)_east.set(1,0,0);
      _east.normalize();
      // 日出东方、日落西方：虚拟日向只用于天空着色，不改真实灯光
      const ang=Math.PI*THREE.MathUtils.clamp((tod-.22)/.6,0,1);
      U.glowSunDir.value.copy(_east).multiplyScalar(Math.cos(ang)).addScaledVector(U.localUp.value,Math.max(.03,Math.sin(ang)*.35)).normalize();
      if(duskG>=dawnG){U.glowGold.value.setHex(0xffb872);U.glowRose.value.setHex(0xf08490);U.glowViolet.value.setHex(0x5c64a8);}
      else{U.glowGold.value.setHex(0xffd896);U.glowRose.value.setHex(0xf4a6b2);U.glowViolet.value.setHex(0x86a6d4);}
      const crystalUp=scene.userData.moebiusV10SkyUp;
      skyMat.uniforms.moebiusV10Blend.value=(crystalUp?THREE.MathUtils.smoothstep(camera.position.clone().normalize().dot(crystalUp),.45,.75):0)*(1-.85*glow);
      if(crystalUp)skyMat.uniforms.moebiusV10Up.value.copy(crystalUp);
      skyMat.uniforms.moebiusV10Day.value=1-THREE.MathUtils.smoothstep(Math.abs((P.timeOfDay??.5)-.5),.22,.43);
      const city=scene.getObjectByName('highland-west-city');
      if(!city)return;
      city.localToWorld(anchor.set(35,15,20));
      const targetStyle=U.citadelTargetStyle.value>0;
      // Include the city overview camera in the local noon palette; otherwise
      // legacy turquoise bleeds into the target sky at the review distance.
      const distance=camera.position.distanceTo(anchor);
      const near=1-THREE.MathUtils.smoothstep(distance,170,320);
      const targetNear=targetStyle?1-THREE.MathUtils.smoothstep(distance,300,450):near;
      const dusk=1-THREE.MathUtils.smoothstep(Math.abs((P.timeOfDay??.5)-.85),.025,.14);
      skyMat.uniforms.citadelBlend.value=near*dusk*(1-glow);
      const highland=scene.getObjectByName('highland-gate');
      const gateNear=highland?1-THREE.MathUtils.smoothstep(camera.position.distanceTo(highland.position),140,230):0;
      // 圣城白天天色只在正午前后生效，朝霞暮云时让位给昼夜本色与霞光
      const holyNoon=1-THREE.MathUtils.smoothstep(Math.abs(tod-.5),.12,.2);
      skyMat.uniforms.holyDayBlend.value=(highland?.userData.round>=21||skyMat.uniforms.citadelTargetStyle.value>0)?Math.max(targetNear,gateNear)*holyNoon*(1-glow):0;
      skyMat.uniforms.citadelUp.value.set(0,1,0).transformDirection(city.matrixWorld);
      if(U.citadelTargetStyle.value>0&&scene.fog&&Number.isFinite(legacyFogDensity)){
        const weight=U.holyDayBlend.value;
        scene.fog.density=THREE.MathUtils.lerp(legacyFogDensity,.00075,weight);
        scene.fog.color.lerp(targetFog,weight);
      }
    };
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
    // K4：日轮光晕迁入 LocalLightRegistry（V5 下由 registry 决定它是否变真实灯）
    registerLocalLight(sunHalo, {
      id: "sun-halo",
      owner: "environment",
      kind: "point",
      color: 0xffe8b0,
      intensity: 0.35,
      radius: 100,
      priority: 2,
    });
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

  return { lanterns, ambient, sun: dir, skyMat, hemi, fill };
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
