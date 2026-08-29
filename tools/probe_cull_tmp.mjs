globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener(){}, removeEventListener(){}, requestAnimationFrame(){}, matchMedia: () => ({ matches: false, addEventListener(){}, removeEventListener(){} }) };
const stubEl = () => ({ style: {}, classList: { add(){}, remove(){}, toggle(){}, contains: () => false }, textContent: "", appendChild(){}, addEventListener(){}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect(){}, clearRect(){}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop(){} }), fillText(){}, drawImage(){}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()), createElementNS: (_n, t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild(){} }, addEventListener(){} };
globalThis.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
const BASE = new URL("../TigerMessenger/", import.meta.url);
const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const citadelModule = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const castle = citadelModule.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
castle.updateMatrixWorld(true);
const SEA = 4.95;         // 城堡局部海面（= world 160.72 − origin 155.77）
const MARGIN = 1.2, MAXR = 30;
const exempt = /swamp|saihoji|moebius|湖沼|lake|leviathan|whale|fish|dolphin|boat|ship|warship|player|agent|bird|pile|pier|dock|quay|lantern|bubble|pod|canopy|groves|slope-grass|hero-cloud|distance/i;
const bigExempt = /planet|ocean|sea|sky|terrain|mountain|canyon/i;
const hidden = [];
castle.traverse((o) => {
  if (!o.isMesh || !o.visible) return;
  const g = o.geometry;
  if (!g?.attributes?.position) return;
  if (!g.boundingSphere) g.computeBoundingSphere();
  const r = g.boundingSphere?.radius;
  if (!Number.isFinite(r) || r > MAXR) return;
  if (bigExempt.test(o.name || "")) return;
  if (exempt.test(o.name || "")) return;
  let node = o.parent;
  for (let d = 0; node && d < 5; d++) { if (exempt.test(node.name || "")) return; node = node.parent; }
  const wp = o.getWorldPosition(new THREE.Vector3());
  // place:false → 城堡局部即世界；生产中局部 y + 155.77 = world。海面 local = 4.95
  const depth = SEA - wp.y;
  if (depth < MARGIN) return;
  hidden.push({ name: o.name || o.parent?.name || "?", y: +wp.y.toFixed(2), depth: +depth.toFixed(2), r: +r.toFixed(1) });
});
console.log("hidden count:", hidden.length);
const byName = new Map();
for (const h of hidden) {
  const k = h.name.replace(/[-_]?\d+$/, "").slice(0, 30);
  byName.set(k, (byName.get(k) || 0) + 1);
}
[...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).forEach(([k, n]) => console.log(String(n).padStart(4), k));
console.log("samples:", hidden.slice(0, 6).map(h => `${h.name}@y${h.y}`).join(" | "));
