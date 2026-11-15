import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = process.argv[2] || new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(root + '/vendor/three.module.js').href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const src = (await import('node:fs')).readFileSync(root + '/src/world/vikings/bookshopBoarding.js', 'utf8');
const a = src.indexOf('const NOT_DECK'), b = src.indexOf('/** 一船甲板上的维京人');
const deckSlots = new Function('THREE', src.slice(a, b) + '\nreturn deckSlots;')(THREE);
// 船：放在星球表面 r=160 处，船长沿 z 20 m，主甲板 y=1.5，舱室 z∈[-3,5] 高到 4，烟囱到 8，斜跳板伸出船外
const planet = new THREE.Group(), ship = new THREE.Group(); ship.position.set(0, 160, 0); planet.add(ship);
const box = (w, h, d, x, y, z, name = '') => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial()); m.position.set(x, y, z); m.name = name; ship.add(m); return m; };
box(5, 3, 20, 0, 0, 0, 'hull');           // top 1.5
box(3.4, 2.5, 8, 0, 2.75, 1, 'cabin');    // top 4
box(1, 4, 1, 0, 6, 1, 'funnel');          // top 8
const g = box(1.1, .12, 3.4, 3.5, 2.5, -4, 'duke-gangway'); g.rotation.x = -0.86;
box(0.1, 9, 0.1, 0, 5, -7, 'mast');
const out = deckSlots(ship, 14).slots;
const ys = out.map((p) => +p.y.toFixed(2)), xs = out.map((p) => +p.x.toFixed(2)), zs = out.map((p) => +p.z.toFixed(2));
console.log(JSON.stringify({ ys, xs, zs }));
if (!out.every((p) => Math.abs(p.y - 1.5) < 0.05)) throw Error('not on main deck');
if (!out.every((p) => Math.abs(p.x) < 2.5)) throw Error('off hull');
if (out.some((p) => p.z > -3 && p.z < 5 && Math.abs(p.x) < 1.7)) throw Error('inside cabin');
console.log('PASS 甲板位全在主甲板、船体内、不在舱里/跳板上');
