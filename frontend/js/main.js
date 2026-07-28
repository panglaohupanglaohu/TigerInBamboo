// 启动：铺纸、研墨、布景
import * as THREE from "../assets/vendor/three/three.module.js";
import { OrbitControls } from "../assets/vendor/three/jsm/controls/OrbitControls.js";
import { loadConfig } from "./config.js";
import { Environment, streamQuery, streamCurve } from "./environment.js";
import { BambooGrove } from "./bamboo.js";
import { Tiger } from "./tiger.js";
import { Rabbit } from "./rabbit.js";
import { Scenery } from "./scenery.js";
import { WaterPlants } from "./plants.js";
import { CameraDirector, updateAgentPanel } from "./ui.js";
import { PhysicsWorld } from "./physics.js";
import { BgmPlayer } from "./bgm.js";
import { DialogSystem } from "./dialog.js";
import { CustomAgent, loadSavedSpecies } from "./custom.js";
import { BirdAgent, randomPheasantPerchSpot, randomPheasantSpot } from "./bird.js";
import { TigerSfx } from "./sfx.js";
import "./panels.js"; // 面板推拉收合（竖柄）

const FOOT_BONES = ["FLFoot", "FRFoot", "BLFoot", "BRFoot"];
const _footPos = new THREE.Vector3();
/** 检测虎四足是否踏入溪水；落水瞬间在接触点生成外扩涟漪（绕石衍射）。
 *  throttled：每只脚 0.35s 内只生一道，避免一脚连刷。strength 随虎速增大。 */
function spawnTigerFootRipples(tiger, env, time) {
  const boneMap = tiger.entity?.boneMap;
  if (!boneMap) return;
  const speed = tiger._speedCur ?? 0;
  for (const name of FOOT_BONES) {
    const bone = boneMap.get(name);
    if (!bone) continue;
    bone.getWorldPosition(_footPos);
    const q = streamQuery(_footPos.x, _footPos.z);
    const inStream = q.d < q.halfW * 0.92;
    const wl = q.elev - 0.12;
    const planting = _footPos.y < wl + 0.18; // 脚接近/没入水面 = 触水
    if (inStream && planting) {
      const last = bone._rippleT ?? -1;
      if (time - last > 0.35) {
        bone._rippleT = time;
        const strength = 0.5 + Math.min(speed / 1.15, 1) * 0.9;
        env.spawnFootRipple(_footPos.x, _footPos.z, strength);
      }
    }
  }
}

async function boot() {
  const config = await loadConfig();

  // BGM：歌单顺序循环（配置页可增删排序；首次交互后启动，缺曲自动跳过）
  const playlist = config.bgm?.playlist?.length
    ? config.bgm.playlist
    : ["assets/audio/bgm.mp3", "assets/audio/duange_xing.mp3"];
  const bgm = new BgmPlayer(playlist, { volume: config.bgm?.volume ?? 0.5 });

  const canvas = document.getElementById("stage");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(4, 10, 30);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 4;
  controls.maxDistance = 70;
  controls.target.set(0, 1.5, 0);

  const physics = new PhysicsWorld(config);
  const env = new Environment(scene, config, physics);
  const grove = new BambooGrove(scene, config, null, physics);
  const tiger = new Tiger(scene, config, physics);
  tiger.obstacles = env.rockObstacles ?? []; // 岩石刚体：行走/捕猎绕石而行，不穿模
  // 决策：不采用 GLB 虎（四肢不分），保留程序化虎模型
  const rabbit = new Rabbit(scene, config, grove); // 雪兔：SALTATORIAL 管线验证物种
  const dialog = new DialogSystem(tiger, rabbit, config); // 母女对话（虎女·兔母）
  // 锦鸡群：觅食/饮水/警觉/奔逃/惊飞（fear 内驱力），数量由配置决定。
  // 分布：1/2 落远处林缘雪坡，1/2 落溪涧岸边。
  const pheasants = [];
  {
    const n = Math.max(0, Math.min(6, Math.round(config.pheasant.count ?? 1)));
    for (let i = 0; i < n; i++) {
      let spot;
      if (i % 2 === 0) {
        // 远处：林缘/雪坡（远离溪涧）
        spot = randomPheasantSpot({ minStreamDistance: 8.0 });
      } else {
        // 溪涧边：河道曲线旁 2~4 米
        const p = streamCurve.getPointAt(Math.random());
        const side = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        spot = p.clone().addScaledVector(side, 2 + Math.random() * 2);
        spot.y = 0;
      }
      const perch = i % 2 === 0
        ? randomPheasantPerchSpot(spot, { minStreamDistance: 8.0 })
        : spot.clone();
      pheasants.push(new BirdAgent(scene, config, {
        forage: [spot.x, spot.z],
        perch: [perch.x, perch.z],
      }));
    }
  }
  const sfx = new TigerSfx({ volume: config.hunt?.sfxVolume ?? 0.8 }); // 虎啸：奔跑短吼/飞扑咆哮/进食咀嚼

  // 跃起落点雪花飞溅：自地面向上呈半球体向四周喷溅，体现跃起击杀力度
  const snowSplash = (() => {
    const MAX = 360;
    const pos = new Float32Array(MAX * 3);
    const vel = new Float32Array(MAX * 3);
    const life = new Float32Array(MAX);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xf6f9fa, size: 0.075, transparent: true, opacity: 0.95, depthWrite: false,
    }));
    points.frustumCulled = false;
    scene.add(points);
    let head = 0;
    return {
      spawn(center, strength = 1) {
        const n = Math.round(90 + strength * 70);
        for (let i = 0; i < n; i++) {
          const idx = head = (head + 1) % MAX;
          const az = Math.random() * Math.PI * 2;
          const el = (0.12 + Math.random() * 0.38) * Math.PI; // 半球：仰角 20°~90°
          const speed = (2.2 + Math.random() * 3.6) * (0.7 + strength * 0.5);
          pos[idx * 3] = center.x + (Math.random() - 0.5) * 0.5;
          pos[idx * 3 + 1] = Math.max(0.02, center.y) + Math.random() * 0.08;
          pos[idx * 3 + 2] = center.z + (Math.random() - 0.5) * 0.5;
          vel[idx * 3] = Math.cos(az) * Math.cos(el) * speed;
          vel[idx * 3 + 1] = Math.sin(el) * speed;
          vel[idx * 3 + 2] = Math.sin(az) * Math.cos(el) * speed;
          life[idx] = 0.8 + Math.random() * 0.8;
        }
        geo.attributes.position.needsUpdate = true;
      },
      update(dt) {
        let any = false;
        for (let i = 0; i < MAX; i++) {
          if (life[i] <= 0) continue;
          any = true;
          life[i] -= dt;
          vel[i * 3 + 1] -= 7.5 * dt;
          pos[i * 3] += vel[i * 3] * dt;
          pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
          pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
          if (pos[i * 3 + 1] < 0.01) { pos[i * 3 + 1] = 0.01; vel[i * 3 + 1] = 0; }
        }
        points.visible = any;
        if (any) geo.attributes.position.needsUpdate = true;
      },
    };
  })();
  tiger.onLeapLand = (center) => snowSplash.spawn(center, 1.2); // 跃起落地：雪花飞溅
  tiger.onAirCatch = () => { /* 空捕瞬间：子弹时间由 slowmoLeft 驱动（主循环） */ };
  // 竹被挤扰：沙沙声 + 竹顶积雪簌落
  grove.onDisturb = (b, k) => {
    sfx.rustle(0.4 + k * 0.6);
    grove.spawnSnowBurst(b.x, b.baseY + b.height * (0.55 + Math.random() * 0.4), b.z, k);
  };  // 物种实验室保存的自定义物种：入画漫游并按关系矩阵互动
  const speciesRec = await loadSavedSpecies();
  const custom = speciesRec ? new CustomAgent(scene, speciesRec, {
    // 溪涧场景适配器：把环境/竹林/虎封装给自定义物种
    groundHeight: (x, z) => env.groundHeight(x, z),
    isWater: (x, z) => { const q = streamQuery(x, z); return q.d < q.halfW; },
    waterLevel: 0,
    // 仅西侧雪原（离岸 >3m）易滑
    snowSlick: (x, z) => { const q = streamQuery(x, z); return q.d > q.halfW + 3 ? 0.85 : 0; },
    home: new THREE.Vector3(-5, 0, 8),
    wanders: grove.bamboos.map((b) => ({ x: b.x, z: b.z })),
    waterPoint: () => new THREE.Vector3(-3.5 + (Math.random() - 0.5) * 2, 0, 3 + (Math.random() - 0.5) * 4),
    getOther: () => tiger?.group.position ?? null,
    who: "tiger",
    avesForage: [-5, 8],
    avesPerch: [-8.5, 3.5],
  }, { pheasant: { enabled: true, fleeDistance: 6, returnDistance: 14, drinkInterval: 25, perchTime: 4 } }) : null;
  if (custom) {
    const el = document.getElementById("agent-custom");
    if (el) {
      el.style.display = "";
      document.getElementById("custom-name").textContent = custom.cnName;
    }
  }
  const scenery = new Scenery(scene);
  new WaterPlants(scene, config, env); // 菖蒲（靠水石旁，翠叶白花）+ 芦苇（阔水两岸，浅赭叶）
  const director = new CameraDirector(camera, controls);
  window.__dbg = { tiger, rabbit, dialog, custom, pheasants, sfx, camera, controls, director, physics, grove, bgm }; // 调试钩子：截图/调试用
  if (config.style?.cameraPreset) director.set(config.style.cameraPreset);

  // 静音切换按钮
  const muteBtn = document.getElementById("bgm-toggle");
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      muteBtn.textContent = bgm.toggleMute() ? "♪ 启乐" : "♪ 静音";
    });
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  let hudClock = 0;
  let prevHuntStage = null, prevBioState = null;
  renderer.setAnimationLoop(() => {
    const rawDt = Math.min(clock.getDelta(), 0.05);
    // 子弹时间：空捕触发 slowmoLeft，全局慢镜头（相机操作不受影响感）
    const timeScale = (tiger.slowmoLeft ?? 0) > 0 ? (config.hunt?.bulletTimeScale ?? 0.22) : 1;
    tiger.slowmoLeft = Math.max(0, (tiger.slowmoLeft ?? 0) - rawDt);
    const dt = rawDt * timeScale;
    const time = clock.elapsedTime;

    env.update(dt);
    // 捕食开关：任意背景音乐播放时虎皆可狩猎
    tiger.pheasants = pheasants;
    tiger.huntArmed = !!config.hunt?.enabled;
    tiger.update(dt, time, grove, rabbit);
    // 虎足触水：四只脚各自落入溪涧时，在该接触点触发一道外扩涟漪（绕石自动衍射）
    spawnTigerFootRipples(tiger, env, time);
    // 虎啸：捕食阶段切换 + 驻足咆哮的音效联动
    const huntStage = tiger._hunt?.stage ?? null;
    if (huntStage !== prevHuntStage) {
      if (huntStage === "stalk") sfx.growl();
      else if (huntStage === "sprint") sfx.snarl();
      else if (huntStage === "pounce") sfx.roar();
      else if (huntStage === "feed") sfx.chew();
      prevHuntStage = huntStage;
    }
    const bioS = tiger.entity.currentState;
    if (bioS !== prevBioState) {
      if (bioS === "ROAR" && !huntStage) sfx.roar(); // 驻足咆哮（捕食飞扑已在上方配过）
      prevBioState = bioS;
    }
    env.updateWader(tiger.group.position, tiger._speedCur ?? 0); // 虎涉水起涟
    rabbit.update(dt, time, tiger);
    custom?.update(dt, time, tiger);
    for (const p of pheasants) p.update(dt, time, tiger.group.position);
    dialog.update(dt, camera);
    grove.update(dt, tiger.group.position); // 施加回正/风扭矩
    grove.updateSnowBurst(dt);               // 落雪粒子推进
    snowSplash.update(dt);                   // 跃起落点雪花飞溅推进
    physics.step(dt);                        // Cannon 解算：虎推竹、碰撞
    grove.syncFromPhysics();                 // 物理位姿写回可视模型
    director.update(dt, tiger, pheasants[0] ?? null);

    hudClock += dt;
    if (hudClock > 0.25) { hudClock = 0; updateAgentPanel(tiger, rabbit, custom, pheasants); }

    renderer.render(scene, camera);
  });

  document.getElementById("loading")?.classList.add("done");
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById("loading");
  if (el) el.textContent = "装裱失败：" + err.message;
});
