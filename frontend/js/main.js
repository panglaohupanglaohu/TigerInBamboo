// 启动：铺纸、研墨、布景
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadConfig } from "./config.js";
import { Environment } from "./environment.js";
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
import { BirdAgent } from "./bird.js";
import { TigerSfx } from "./sfx.js";
import "./panels.js"; // 面板推拉收合（竖柄）

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
  // 决策：不采用 GLB 虎（四肢不分），保留程序化虎模型
  const rabbit = new Rabbit(scene, config, grove); // 雪兔：SALTATORIAL 管线验证物种
  const dialog = new DialogSystem(tiger, rabbit, config); // 母女对话（虎女·兔母）
  // 锦鸡群：觅食/饮水/警觉/奔逃/惊飞（fear 内驱力），数量由配置决定
  // 活动点均距兔穴（-1,4）≥38m：母女团聚不被打扰，虎猎需长途奔袭
  const pheasants = [];
  {
    const spots = [[39, 4], [-1, -36], [35, 23], [30, -22], [-33, 26], [-25, 34]];
    const n = Math.max(0, Math.min(6, Math.round(config.pheasant.count ?? 1)));
    for (let i = 0; i < n; i++) {
      const [fx, fz] = spots[i % spots.length];
      const jx = (Math.random() - 0.5) * 1.5, jz = (Math.random() - 0.5) * 1.5;
      pheasants.push(new BirdAgent(scene, config, { forage: [fx + jx, fz + jz], perch: [fx - 6, fz + 6] }));
    }
  }
  const sfx = new TigerSfx({ volume: config.hunt?.sfxVolume ?? 0.8 }); // 虎啸：潜行低吼/爆发短吼/飞扑咆哮/进食咀嚼
  // 竹被挤扰：沙沙声 + 竹顶积雪簌落
  grove.onDisturb = (b, k) => {
    sfx.rustle(0.4 + k * 0.6);
    grove.spawnSnowBurst(b.x, b.baseY + b.height * (0.55 + Math.random() * 0.4), b.z, k);
  };  // 物种实验室保存的自定义物种：入画漫游并按关系矩阵互动
  const speciesRec = await loadSavedSpecies();
  const custom = speciesRec ? new CustomAgent(scene, speciesRec, grove, config) : null;
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
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    env.update(dt);
    // 捕食开关：仅当当前曲目为触发曲（默认《短歌行》）时虎开启狩猎
    tiger.pheasants = pheasants;
    tiger.huntArmed = !!config.hunt?.enabled &&
      (bgm.tracks?.[bgm._idx] ?? "").includes(config.hunt?.musicTrigger ?? "duange_xing.mp3");
    tiger.update(dt, time, grove, rabbit);
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
