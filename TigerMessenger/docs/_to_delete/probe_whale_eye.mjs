// 鲸眼半球开合的数值体检：闭合时两枚半球必须把眼珠整个包住，
// 张开时必须转到背离镜头的一侧（不是挡在眼前，也不是原地缩放）。
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" }));
}
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", appendChild() {}, addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const lev = await import(new URL("src/assets/leviathanIsland.js", BASE).href);

const fn = lev.buildEcoLeviathanIsland;
const made = fn({ radius: 160 });
const group = made?.group || made?.object || made;
const eyes = group?.userData?.leviathanEyes
  || made?.userData?.leviathanEyes
  || (made?.group || made)?.userData?.leviathanEyes;

console.log("导出：", Object.keys(lev).filter((k) => /^(create|build)/.test(k)).join(", "));
if (!eyes) { console.log("找不到 leviathanEyes；返回对象键：", Object.keys(made || {})); process.exit(1); }
console.log(`眼睛 ${eyes.length} 组`);

const world = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };

for (const e of eyes) {
  const tag = e.side < 0 ? "L" : "R";
  const setAng = (open) => {
    const ang = Math.PI * 0.46 * open;
    e.lidTop.rotation.x = -e.side * ang;
    e.lidBot.rotation.x = e.side * ang;
    e.eyeRoot.updateWorldMatrix(true, true);
  };
  const eyeBox = world(e.eye);
  const eyeC = eyeBox.getCenter(new THREE.Vector3());

  setAng(0); // 全闭
  const closed = world(e.lidTop).union(world(e.lidBot));
  const covers = closed.containsBox(eyeBox);

  setAng(1); // 全开
  const openTop = world(e.lidTop).getCenter(new THREE.Vector3());
  const openBot = world(e.lidBot).getCenter(new THREE.Vector3());
  // 「背离镜头」= 沿眼睛朝外的法线（≈ eyeRoot 的 ±Z 世界方向）为负
  const outward = new THREE.Vector3(0, 0, e.side)
    .applyQuaternion(e.eyeRoot.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const dTop = openTop.clone().sub(eyeC).dot(outward);
  const dBot = openBot.clone().sub(eyeC).dot(outward);

  // 全开时两枚壳的最前沿（沿外法线）必须退到眼珠最前沿之后，否则还挡着眼睛
  const front = (box) => {
    let best = -Infinity;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      best = Math.max(best, new THREE.Vector3(x, y, z).sub(eyeC).dot(outward));
    }
    return best;
  };
  const lidFront = Math.max(front(world(e.lidTop)), front(world(e.lidBot)));
  const eyeFront = front(eyeBox);
  const stillCovers = world(e.lidTop).union(world(e.lidBot)).containsBox(eyeBox);
  console.log(
    `  ${tag}: 闭合包住眼珠 ${covers ? "✓" : "✗"}` +
    ` · 全开仍挡着 ${stillCovers ? "✗ 还挡着" : "✓ 让开了"}` +
    ` · 全开壳最前沿 ${lidFront.toFixed(2)} vs 眼珠最前沿 ${eyeFront.toFixed(2)}` +
    ` · 张开时上壳沿外法线 ${dTop.toFixed(2)}（应为负=缩到脑袋里）` +
    ` · 下壳 ${dBot.toFixed(2)}`
  );
}
