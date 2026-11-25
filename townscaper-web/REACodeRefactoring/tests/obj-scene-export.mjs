import assert from 'node:assert/strict';import {geometryData,bakeInstances,sceneToOBJ,sceneParts} from '../src/tools/objexport.js';
const attr=a=>({itemSize:3,count:a.length/3,getX:i=>a[i*3],getY:i=>a[i*3+1],getZ:i=>a[i*3+2]});
const idx=a=>({count:a.length,getX:i=>a[i]});
const geo=(o={})=>({getAttribute:n=>o[n]?attr(o[n]):null,getIndex:()=>o.index?idx(o.index):null});
const mat4=e=>({elements:e});
const IM=a=>({array:Float32Array.from(a)});
const IDENT=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

/* geometryData：无索引/索引、矩阵烘焙、坏数据拒绝 */
{const g=geo({position:[0,0,0, 1,0,0, 0,1,0]});const d=geometryData(g);assert.deepEqual(d.faces,[0,1,2]);assert.equal(d.normals,null);
 const t=geometryData(g,{matrix:[1,0,0,0,0,1,0,0,0,0,1,0,5,0,-2,1]});assert.deepEqual(t.positions,[5,0,-2, 6,0,-2, 5,1,-2]);
 const gi=geo({position:[0,0,0, 1,0,0, 0,1,0],index:[0,1,2]});assert.deepEqual(geometryData(gi).faces,[0,1,2]);
 assert.throws(()=>geometryData(geo({position:[0,0,NaN, 1,0,0, 0,1,0]})));
 assert.throws(()=>geometryData(geo({position:[0,0,0, 1,0,0, 0,1,0],index:[0,1,9]})));
 assert.throws(()=>geometryData(null));}

/* bakeInstances：2 实例（单位矩阵 + 平移×2 缩放），逐实例色、法线归一 */
{const tri=geo({position:[0,0,0, 1,0,0, 0,0,1],normal:[0,1,0, 0,1,0, 0,1,0],index:[0,1,2]});
 const mesh={geometry:tri,count:2,instanceMatrix:IM([...IDENT, 2,0,0,0, 0,2,0,0, 0,0,2,0, 10,3,7,1]),
   instanceColor:attr([1,0,0, 0,0,1])};
 const b=bakeInstances(mesh);
 assert.equal(b.instances,2);assert.equal(b.positions.length,18);assert.equal(b.faces.length,6);
 assert.deepEqual(b.positions.slice(0,3),[0,0,0]);assert.deepEqual(b.positions.slice(9,12),[10,3,7]);assert.deepEqual(b.positions.slice(12,15),[12,3,7]);
 assert.equal(b.colors.length,18);assert.deepEqual(b.colors.slice(0,3),[1,0,0]);assert.deepEqual(b.colors.slice(9,12),[0,0,1]);
 assert.ok(b.normals.every(n=>Math.abs(n)<=1));assert.deepEqual(b.normals.slice(9,12),[0,1,0]);
 // count=0 → 空但不抛
 assert.deepEqual(bakeInstances({geometry:tri,count:0,instanceMatrix:IM(IDENT)}).positions,[]);
 // 几何实例属性 aColor 兜底
 const tri2=geo({position:[0,0,0, 1,0,0, 0,0,1],aColor:[0,1,0, 0,0,1]});
 const b2=bakeInstances({geometry:tri2,count:2,instanceMatrix:IM([...IDENT,...IDENT])});
 assert.deepEqual(b2.colors.slice(0,3),[0,1,0]);assert.deepEqual(b2.colors.slice(9,12),[0,0,1]);
 // 外部 base 矩阵叠加实例矩阵
 const b3=bakeInstances({geometry:tri,count:1,instanceMatrix:IM(IDENT)},{base:[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,5,1]});
 assert.deepEqual(b3.positions.slice(6,9),[0,0,6]);}

/* sceneToOBJ：mtllib/o/usemtl、跨 part 顶点去重、MTL Kd、坏输入拒绝 */
{const p1={name:'town',material:'town',kd:[1,1,1],positions:[0,0,0, 1,0,0, 0,1,0],normals:[0,0,1, 0,0,1, 0,0,1],colors:[1,0,0, 0,1,0, 0,0,1],faces:[0,1,2]};
 const p2={name:'water',material:'water',kd:[0.4,0.6,0.65],positions:[0,0,0, 1,0,0, 0,0,1, 1,0,1],faces:[0,1,2, 1,3,2]};
 const p2b={...p2,name:'water2'};
 const r=sceneToOBJ([p1,p2,p2b],{name:'demo',mtl:'demo.mtl'});
 assert.ok(r.text.includes('mtllib demo.mtl'));assert.ok(r.text.includes('o town\nusemtl town'));assert.ok(r.text.includes('o water\nusemtl water'));
 assert.equal(r.faces,5);assert.equal(r.parts[0].faces,1);assert.equal(r.parts[1].faces,2);assert.equal(r.parts[2].faces,2);
 // town 顶点带色带法线、water 不带 → 不同键；water2 与 water 全同 → 跨 part 复用同一批顶点
 const vs=r.text.split('\n').filter(l=>l.startsWith('v '));assert.equal(vs.length,3+4);   // town 3 + water 4，water2 复用
 const wf=r.text.split('\n').filter(l=>l.startsWith('f '));assert.equal(wf[1],wf[3]);assert.equal(wf[2],wf[4]);
 assert.deepEqual(r.materials,['town','water']);
 assert.ok(r.mtlText.includes('newmtl water\nKd 0.4 0.6 0.65'));assert.ok(r.mtlText.includes('newmtl town\nKd 1 1 1'));
 // f 行回解析：town 用 vn 语法、water 无 vn
 const fl=r.text.split('\n').filter(l=>l.startsWith('f '));assert.equal(fl.length,5);assert.match(fl[0],/f \d+\/\/\d+/);assert.match(fl[1],/^f \d+ \d+ \d+$/);
 // 退化面丢弃计数 + 无材质 part 省略 usemtl
 const p3={name:'x',positions:[0,0,0, 0,0,0, 1,0,0],faces:[0,1,2]};
 const r2=sceneToOBJ([p3],{mtl:'x.mtl'});assert.equal(r2.parts[0].droppedFaces,1);assert.equal(r2.parts[0].faces,0);assert.ok(!r2.text.includes('usemtl'));
 assert.throws(()=>sceneToOBJ([],{}));assert.throws(()=>sceneToOBJ([{name:'b',positions:[0,0],faces:[0,1,2]}],{}));
 assert.throws(()=>sceneToOBJ([{name:'b',positions:[0,0,0,1,0,0,0,1,0],faces:[0,1]}],{}));
 assert.throws(()=>sceneToOBJ([{name:'b',positions:[0,0,0,1,0,0,0,1,0],faces:[0,1,9]}],{}));}

/* sceneParts：stub view 收集 town/water/植被，隐藏或 0 计数跳过 */
{const townG=geo({position:[0,0,0, 1,0,0, 0,1,0],normal:[0,0,1,0,0,1,0,0,1],color:[1,1,1,1,1,1,1,1,1]});
 const waterG=geo({position:[-1,0,-1, 1,0,-1, -1,0,1, 1,0,1],index:[0,1,2, 1,3,2]});
 const crownG=geo({position:[0,0,0, .5,0,0, 0,.5,0]});
 const view={worldMesh:{geometry:townG},water:{geometry:waterG,matrixWorld:mat4(IDENT)},
   waterUniforms:{uShallow:{value:{r:.37,g:.62,b:.66}},uDeep:{value:{r:.31,g:.56,b:.60}}},
   vegetation:{tufts:{count:0,geometry:crownG,instanceMatrix:IM(IDENT)},
     crowns:[{m:{count:1,geometry:crownG,instanceMatrix:IM(IDENT),instanceColor:attr([0,.5,.2])}},{}]}};
 const parts=sceneParts(view);assert.deepEqual(parts.map(p=>p.name),['town','water','crown0']);
 assert.equal(parts[1].material,'water');assert.ok(Math.abs(parts[1].kd[0]-(.31+(.37-.31)*.55))<1e-9);
 assert.equal(parts[2].instances,1);assert.deepEqual(parts[2].colors,[0,.5,.2, 0,.5,.2, 0,.5,.2]);
 const r=sceneToOBJ(parts,{mtl:'s.mtl'});assert.deepEqual(r.materials,['town','water','veg_crown0']);}
console.log('PASS scene OBJ bake/parts/mtl');
