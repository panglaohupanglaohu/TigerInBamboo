// 海面倒影跟随原件（2026-11-10 用户截图「这个倒影是不是做错了」：船开走后倒影还留在原处、半透明双面像 X 光片）。
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { buildReflections } = await import(pathToFileURL(join(root, 'src/world/seaStyle/seaStyle.js')).href);
const R = 160, scene = new THREE.Scene();
const ocean = new THREE.Mesh(new THREE.SphereGeometry(R, 8, 8), new THREE.MeshBasicMaterial()); ocean.name = 'planet-v8-curved-ocean'; scene.add(ocean);
const carrier = new THREE.Group(); scene.add(carrier);
const ship = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 12), new THREE.MeshStandardMaterial({ color: 0x884422 })); ship.name = 'duke-coastal-steam-freighter-hull';   // 真船名里没有 ship / boat 词，躲过了名字过滤 → 会进倒影
ship.position.set(0, R + 1.5, 0); carrier.add(ship);
const lamp = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); lamp.position.set(10, R + 1.2, 0); scene.add(lamp);
scene.updateMatrixWorld(true);
const shared = { uCenter: { value: new THREE.Vector3() }, uSeaR: { value: R }, uTime: { value: 0 }, uDistortion: { value: 0 }, uWater: { value: new THREE.Color() }, uNight: { value: 0 }, uMix: { value: .5 }, uOpacity: { value: .8 }, uFade: { value: .3 }, uOn: { value: 1 }, uMaxH: { value: 12 } };
const refl = buildReflections({ scene, ocean, center: new THREE.Vector3(), R, near: () => ({ sea: 0, land: 0 }), style: { maxMeshes: 50, maxTris: 1e6 }, shared, isExcluded: () => false });
const rs = refl.group.children, rShip = rs.find((r) => r.userData.src === ship), rLamp = rs.find((r) => r.userData.src === lamp);
assert.ok(rShip && rLamp, '两件都有倒影');
assert.equal(rShip.material.side, THREE.BackSide, '单面原件 → 倒影只画镜中朝镜头的面（BackSide）');
assert.equal(rLamp.material.side, THREE.DoubleSide, '双面原件保持双面');
// 船开走：载具组绕球心转 30°
carrier.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 6); scene.updateMatrixWorld(true);
refl.sync();
assert.ok(rShip.matrixWorld.equals(ship.matrixWorld), '倒影跟着船走');
const p = new THREE.Vector3().setFromMatrixPosition(rShip.matrixWorld);
assert.ok(p.distanceTo(new THREE.Vector3(0, R + 1.5, 0)) > 50, '不再留在原泊位');
// 原件隐藏 / 移出场景 → 倒影隐藏
ship.visible = false; refl.sync(); assert.equal(rShip.visible, false, '原件隐藏 → 倒影隐藏');
ship.visible = true; carrier.visible = false; refl.sync(); assert.equal(rShip.visible, false, '祖先隐藏 → 倒影隐藏');
carrier.visible = true; refl.sync(); assert.equal(rShip.visible, true, '恢复');
lamp.removeFromParent(); refl.sync(); assert.equal(rLamp.visible, false, '原件移出场景 → 倒影隐藏');
refl.dispose();
console.log('PASS 海面倒影：跟随原件位姿、原件隐藏 / 移除即隐藏、单面原件只画镜中可见面', JSON.stringify(refl.stats));
