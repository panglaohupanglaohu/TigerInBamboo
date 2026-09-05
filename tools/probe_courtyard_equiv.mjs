// 等价性 + 提速验证：新版（稠密位图）与旧版（字符串键）在真实城堡布局上
// 必须**逐位相同**（含 cells 顺序），并报告提速倍数。
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name:"three", version:"0.172.0-local-bridge", type:"module", main:"../../vendor/three.module.js" }));
}
globalThis.window = { innerWidth:1280, innerHeight:720, addEventListener(){}, removeEventListener(){}, requestAnimationFrame(){}, matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}) };
const stubEl = () => ({ style:{}, classList:{add(){},remove(){},toggle(){},contains:()=>false}, textContent:"", appendChild(){}, addEventListener(){}, querySelector:()=>stubEl(), querySelectorAll:()=>[] });
const stubCanvas = () => { const el=stubEl(); el.width=64; el.height=64; el.getContext=()=>({canvas:el,fillRect(){},clearRect(){},measureText:()=>({width:6}),createLinearGradient:()=>({addColorStop(){}}),fillText(){},drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(4)})}); el.toDataURL=()=>""; return el; };
globalThis.document = { createElement:(t)=>String(t).toLowerCase()==="canvas"?stubCanvas():stubEl(), createElementNS:(_n,t)=>String(t).toLowerCase()==="canvas"?stubCanvas():stubEl(), getElementById:()=>stubEl(), querySelector:()=>stubEl(), querySelectorAll:()=>[], body:{appendChild(){}}, addEventListener(){} };
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
await import(new URL("vendor/three.module.js", BASE).href);
const ct = await import(new URL("src/world/citadelTown.js", BASE).href);
const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
/** 旧实现，原样复制（字符串键） */
function oldImpl(grid, cols, rows, levels) {
  const at = (ix, iy, iz) => grid.get(`${ix},${iy},${iz}`) ?? ".";
  const result = [];
  for (let iy = 0; iy < levels; iy++) {
    const seen = new Set();
    for (let ix = 0; ix < cols; ix++) {
      for (let iz = 0; iz < rows; iz++) {
        const startKey = `${ix},${iz}`;
        if (at(ix, iy, iz) !== "." || seen.has(startKey)) continue;
        const queue = [[ix, iz]]; const cells = []; let touchesBoundary = false;
        seen.add(startKey);
        while (queue.length) {
          const [x, z] = queue.pop(); cells.push([x, z]);
          if (x === 0 || z === 0 || x === cols-1 || z === rows-1) touchesBoundary = true;
          for (const [dx, dz] of DIRS) {
            const nx = x+dx, nz = z+dz, key = `${nx},${nz}`;
            if (nx<0||nx>=cols||nz<0||nz>=rows) continue;
            if (seen.has(key) || at(nx, iy, nz) !== ".") continue;
            seen.add(key); queue.push([nx, nz]);
          }
        }
        if (touchesBoundary) continue;
        const topOpen = cells.every(([x,z]) => at(x, iy+1, z) === ".");
        if (!topOpen) continue;
        let solidBorderEdges = 0;
        for (const [x,z] of cells) for (const [dx,dz] of DIRS) if (at(x+dx, iy, z+dz) !== ".") solidBorderEdges++;
        if (solidBorderEdges < 3) continue;
        result.push({ terraceFloor: iy, cells: cells.map(([x,z])=>[x,z]), size: cells.length, solidBorderEdges, topOpen });
      }
    }
  }
  return result;
}

const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const spec = castle.userData.townSpec;
const levels = spec.terraces[0].levels;
const grid = new Map();
levels.forEach((plane, iy) => plane.forEach((row, iz) => {
  [...row].forEach((ch, ix) => { if (ch !== ".") grid.set(`${ix},${iy},${iz}`, ch); });
}));
const cols = levels[0][0].length, rows = levels[0].length, L = levels.length;
console.log(`真实布局：${cols}×${rows}×${L}，实心格 ${grid.size}`);

const a = oldImpl(grid, cols, rows, L);
const b = ct.collectCitadelCourtyardRegions(grid, cols, rows, L);
const norm = (r) => JSON.stringify(r.map((x) => ({ f:x.terraceFloor, c:x.cells.map(([p,q])=>[p,q]), s:x.size, e:x.solidBorderEdges, t:x.topOpen })));
if (norm(a) !== norm(b)) {
  console.log(`❌ 不等价：旧 ${a.length} 区 / 新 ${b.length} 区`);
  process.exit(1);
}
console.log(`✅ 逐位等价：${a.length} 个内院区，cells 顺序也一致`);

const bench = (fn, n) => { fn(); fn(); const t = performance.now(); for (let i=0;i<n;i++) fn(); return (performance.now()-t)/n; };
const N = 40;
const oldMs = bench(() => oldImpl(grid, cols, rows, L), N);
const newMs = bench(() => ct.collectCitadelCourtyardRegions(grid, cols, rows, L), N);
console.log(`旧 ${oldMs.toFixed(2)}ms → 新 ${newMs.toFixed(2)}ms  提速 ${(oldMs/newMs).toFixed(1)}×  单次省 ${(oldMs-newMs).toFixed(2)}ms`);
