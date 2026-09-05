// buildCitadelTown 每次调用都会重造约 60 个"常量几何"。一次编辑要调它 5 次
// （5 个台地），所以这是纯固定成本。本探针量它到底值多少毫秒。
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name:"three", version:"0.172.0-local-bridge", type:"module", main:"../../vendor/three.module.js" }));
}
const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const cs = 2, ch = 1.6, WIN_W = 0.62;
const build = () => {
  const g = [];
  g.push(new THREE.BoxGeometry(cs, ch, cs));
  g.push(new THREE.CylinderGeometry(cs*0.72, cs*0.8, 0.5, 10), new THREE.CylinderGeometry(0.03,0.03,0.4,6));
  g.push(new THREE.BoxGeometry(0.09,0.5,0.09), new THREE.BoxGeometry(cs+0.06,0.07,0.07), new THREE.BoxGeometry(0.07,0.07,cs+0.06));
  g.push(new THREE.BoxGeometry(cs*0.96,0.34,0.12), new THREE.CylinderGeometry(cs*0.2,cs*0.24,0.12,8), new THREE.CylinderGeometry(cs*0.13,cs*0.13,0.035,8));
  g.push(new THREE.BoxGeometry(cs+0.16,0.16,0.09), new THREE.BoxGeometry(cs*0.88,0.07,0.075), new THREE.BoxGeometry(cs+0.16,0.46,0.09));
  g.push(new THREE.BoxGeometry(WIN_W*1.12,WIN_W*1.12,0.05), new THREE.BoxGeometry(WIN_W,WIN_W,0.03),
        new THREE.BoxGeometry(WIN_W*0.09,WIN_W,0.045), new THREE.BoxGeometry(WIN_W,WIN_W*0.09,0.045),
        new THREE.BoxGeometry(WIN_W*0.62,WIN_W*0.62,0.05), new THREE.BoxGeometry(WIN_W*0.44,WIN_W*0.44,0.03));
  g.push(new THREE.BoxGeometry(0.92,0.09,0.16), new THREE.BoxGeometry(1.06,0.1,0.12), new THREE.BoxGeometry(0.3,ch*0.96,0.3));
  g.push(new THREE.BoxGeometry(0.96,0.08,0.5), new THREE.BoxGeometry(0.05,0.42,0.05), new THREE.BoxGeometry(0.96,0.045,0.05),
        new THREE.BoxGeometry(1.08,0.06,0.42), new THREE.BoxGeometry(0.44,0.14,0.22), new THREE.BoxGeometry(1.08,0.06,0.26),
        new THREE.BoxGeometry(0.12,0.035,0.12));
  g.push(new THREE.CylinderGeometry(0.13,0.17,ch,6), new THREE.BoxGeometry(cs*0.92,0.12,0.18), new THREE.BoxGeometry(cs,0.09,0.24));
  g.push(new THREE.CylinderGeometry(0.24,0.24,0.08,10), new THREE.BoxGeometry(0.34,0.06,0.08),
        new THREE.BoxGeometry(0.03,0.5,0.03), new THREE.BoxGeometry(0.26,0.05,0.04),
        new THREE.BoxGeometry(cs*0.16,ch*0.52,cs*0.16), new THREE.BoxGeometry(cs*0.22,0.07,cs*0.22));
  g.push(new THREE.ConeGeometry(cs*0.58,ch*0.55,4), new THREE.BoxGeometry(cs*0.5,ch*0.85,cs*0.5), new THREE.ConeGeometry(cs*0.4,ch*0.95,4));
  g.push(new THREE.BoxGeometry(cs*0.96,0.06,cs*0.96));
  // 檐口三件（C13-4）
  g.push(new THREE.BoxGeometry(cs*1.08,ch*0.03,cs*0.08), new THREE.BoxGeometry(cs*1.08,ch*0.02,cs*0.084));
  return g;
};
build(); build();
const N = 40;
let t = performance.now();
for (let i = 0; i < N; i++) build();
const per = (performance.now() - t) / N;
console.log(`一次 buildCitadelTown 的"常量几何"重造：${build().length} 个 · ${per.toFixed(2)}ms`);
console.log(`一次编辑调 5 次（5 台地）→ 固定浪费 ≈ ${(per*5).toFixed(1)}ms`);
