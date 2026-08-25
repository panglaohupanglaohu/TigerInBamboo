// 瀑布攀爬调试：桩环境下快进攻城，跟踪瀑布道士兵的阶段与到位距离
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(fileURLToPath(bridgePkg))) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), {
    recursive: true,
  });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify({
      name: "three",
      version: "0.172.0-local-bridge",
      type: "module",
      main: "../../vendor/three.module.js",
    })
  );
}

globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  textContent: "",
  appendChild() {},
  addEventListener() {},
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  getContext: () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
    fillRect() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  }),
});
globalThis.document = {
  createElement: () => stubEl(),
  createElementNS: () => stubEl(),
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  body: { appendChild() {} },
  addEventListener() {},
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { WORLD_RADIUS } = await import(new URL("src/world/worldScale.js", BASE).href);
const { SAIHOJI_HUB, latLonToGardenDir } = await import(new URL("src/world/saihoji.js", BASE).href);
const { createSaihojiPhalanxBattle } = await import(
  new URL("src/world/saihojiPhalanx.js", BASE).href
);

const R = WORLD_RADIUS;
const hubDir = latLonToGardenDir(SAIHOJI_HUB.lat, SAIHOJI_HUB.lon, new THREE.Vector3());
const hubEast = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hubDir).normalize();

const scene = new THREE.Scene();
const castle = new THREE.Group();
castle.name = "castleContainer";
castle.position.copy(hubDir).multiplyScalar(R).addScaledVector(hubEast, -80);
// 城堡朝向：局部 +Y 沿径向（台地法向）、局部 +Z 切向（瀑布正立面）——
// 与真实场景一致，否则 castleFwdWorld=(0,0,1) 在攀爬点近乎径向，攻城永远到不了位
castle.quaternion.setFromUnitVectors(
  new THREE.Vector3(0, 1, 0),
  castle.position.clone().normalize()
);
scene.add(castle);
const junction = new THREE.Group();
junction.name = "canal-junction-box";
junction.userData.up = hubDir.clone().multiplyScalar(R).addScaledVector(hubEast, 30).normalize();
scene.add(junction);
const horse = new THREE.Group();
horse.name = "citadel-trojan-horse";
horse.position.copy(castle.position).addScaledVector(hubEast, 6).normalize().multiplyScalar(R + 0.1);
scene.add(horse);
const squad = new THREE.Group();
squad.userData.members = [{ userData: { arrowHits: 0 } }];
scene.add(squad);
const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 24), new THREE.MeshBasicMaterial());
planet.name = "planet-surface";
scene.add(planet);
const tod = 0.45;
const ph = createSaihojiPhalanxBattle({
  scene,
  isWhaleRisen: () => false,
  getSquad: () => squad,
  getTimeOfDay: () => tod,
});

for (let i = 0; i < 20; i++) ph.update(0.1, i * 0.1);
for (let i = 0; i < 550; i++) ph.update(0.1, 2 + i * 0.1);
ph.root.userData.whaleReturned();
let guard = 0;
while (ph.root.userData.phase !== "siege" && guard++ < 600) {
  ph.update(0.1, 84 + guard * 0.1);
}
console.log("phase:", ph.root.userData.phase);

const allBlues = ph.root.children
  .filter((c) => c.name?.startsWith("saihoji-cohort"))
  .flatMap((c) => c.children);
const wf = allBlues.filter((s) => (s.userData.waterfall ?? -1) >= 0);
const ld = allBlues.filter((s) => (s.userData.ladder ?? -1) >= 0);
console.log(`blues=${allBlues.length} waterfall=${wf.length} ladder=${ld.length}`);
const wfLanes0 = ph.root.userData.siegeWaterfallClimbs || [];
console.log(
  `WORLD_RADIUS=${R} lanes=${wfLanes0.length} ` +
    wfLanes0
      .map((l) => `|base|=${l.base.length().toFixed(2)} |top|=${l.top.length().toFixed(2)}`)
      .join(" ")
);
// 桩星面射线自检：从瀑布道柱向地心打一条径向射线
{
  const ray = new THREE.Raycaster();
  ray.far = 30;
  const b = wfLanes0[0]?.base;
  if (b) {
    const dir = b.clone().normalize();
    ray.set(dir.clone().multiplyScalar(R + 15), dir.clone().multiplyScalar(-1));
    const hit = ray.intersectObject(planet, false)[0];
    console.log("桩星面射线命中:", hit ? hit.point.length().toFixed(2) : "MISS");
  }
}

const countStages = (arr) => {
  const m = {};
  for (const s of arr) {
    const st = s.userData.downed ? "downed" : s.userData.siegeStage || "gather";
    m[st] = (m[st] || 0) + 1;
  }
  return JSON.stringify(m);
};

let t = 126;
for (let step = 0; step <= 100; step++) {
  if (step % 10 === 0) {
    let visBlues = 0;
    let visReds = 0;
    let arrows = 0;
    ph.root.traverse((o) => {
      if (o.userData?.phalanxRole && o.visible && !o.userData.dead) {
        if (o.userData.helmSide === "blue") visBlues++;
        if (o.userData.helmSide === "red") visReds++;
      }
      if (o.name === "arrow" || o.userData?.isArrow) arrows++;
    });
    const w0 = wf.find((s) => !s.userData.downed);
    const l0 = ld.find((s) => !s.userData.downed);
    const wfLanes = ph.root.userData.siegeWaterfallClimbs || [];
    const fmt = (s) => {
      if (!s) return "-";
      const lane = (s.userData.waterfall ?? -1) >= 0 ? wfLanes[s.userData.waterfall] : null;
      const dBase = lane ? s.position.distanceTo(lane.base).toFixed(2) : "?";
      return `st=${s.userData.siegeStage} role=${s.userData.phalanxRole} q=${s.userData.queueIdx} |p|=${s.position.length().toFixed(1)} dBase=${dBase} vis=${s.visible}`;
    };
    console.log(
      `t=${t.toFixed(0)}s phase=${ph.root.userData.phase} visB=${visBlues} visR=${visReds} wf=${countStages(wf)} ld=${countStages(ld)}\n   wf0: ${fmt(w0)}\n   ld0: ${fmt(l0)}`
    );
  }
  for (let i = 0; i < 10; i++) ph.update(0.1, t + i * 0.1);
  t += 1;
}
