import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import(process.cwd()+'/src/world/moebiusSwamp.js');
const scene=createMoebiusSwampPlacement({seed:7711,scale:.5});scene.updateMatrixWorld(true);const inner=scene.userData.inner;
const inv=new T.Matrix4().copy(inner.matrixWorld).invert();
const loc=o=>{const b=new T.Box3().setFromObject(o);b.applyMatrix4(inv);return b;};
const f=v=>[v.x,v.y,v.z].map(n=>n.toFixed(1)).join(',');
for(const n of ['world-tree-trunk','swamp-ancient-world-tree','swamp-sinkhole-wall','swamp-underground-waterline']){const o=inner.getObjectByName(n);if(!o){console.log('missing',n);continue;}const b=loc(o);console.log(n,o.type,f(b.min),f(b.max),o.material?.color?.getHexString?.(),o.visible);}
const tr=inner.getObjectByName('world-tree-trunk');console.log('trunk parent',tr.parent.name, tr.geometry.type, JSON.stringify(tr.geometry.parameters), f(tr.position), f(tr.scale));
inner.traverse(o=>{if(/trunk|root/i.test(o.name))console.log('  ',o.name,o.type,o.visible,o.material?.color?.getHexString?.(),f(loc(o).min),f(loc(o).max));});
console.log('whales',inner.userData.whales.length, inner.userData.whales.map(w=>f(w.position)+' s'+w.scale.x+' p'+w.parent.name));
console.log('lotuses',inner.userData.lotuses.map(l=>f(l.position)).join(' | '));
console.log('inner scale',inner.scale.x, 'children',inner.children.length);
// wall radius profile
const wall=inner.getObjectByName('swamp-sinkhole-wall');const p=wall.geometry.attributes.position;let rs={};for(let i=0;i<p.count;i++){const y=Math.round(p.getY(i)+wall.position.y);const r=Math.hypot(p.getX(i),p.getZ(i));(rs[y]??=[]).push(r);}for(const y of Object.keys(rs).sort((a,b)=>a-b))console.log('wall y',y,Math.min(...rs[y]).toFixed(1),Math.max(...rs[y]).toFixed(1));
console.log(Object.keys(inner.userData).join(' '));
const {createSwampLivingPathConstraints}=await import(process.cwd()+'/src/world/swampGregLivingPaths.js');
const c=createSwampLivingPathConstraints(inner);
const pr=p=>`(${p.map(n=>n.toFixed(1)).join(',')} a${Math.atan2(p[2],p[0]).toFixed(2)} r${Math.hypot(p[0],p[2]).toFixed(1)})`;
console.log('route',c.route.length, c.route.filter((_,i)=>i%3==0).map(pr).join(' '));
console.log('zones',c.zones.map(z=>z.type+pr(z.min)+pr(z.max)).join('\n'));
console.log('water',c.waterRoute.filter((_,i)=>i%8==0).map(pr).join(' '));
// scan rim allowed
for(let a=0;a<6.28;a+=0.3){let s='';for(const r of [35,36.5,38,39.5,41,42.5]){const p=[Math.cos(a)*r,40,Math.sin(a)*r];s+=c.inspectPlant({position:p,radius:2,height:4}).allowed?'O':'x';}console.log('rim a',a.toFixed(1),s);}
const g=inner.userData.sampleGroundRadius;
for(let a=0;a<6.28;a+=0.6){let s='';for(const r of [34,36,38,40,42,44])s+=(g?.(new T.Vector3(Math.cos(a)*r,45,Math.sin(a)*r))??NaN).toString().slice(0,5)+' ';console.log('ground a',a.toFixed(1),s);}
const rc=new T.Raycaster();
const toW=v=>v.clone().applyMatrix4(inner.matrixWorld);
for(const a of [1.2,2.75,3.3,3.85,0.0,-1.0]){for(const y of [26,32,39.5]){const o=toW(new T.Vector3(0,y,0));const d=toW(new T.Vector3(Math.cos(a),y,Math.sin(a))).sub(o).normalize();rc.set(o,d);const hs=rc.intersectObject(inner,true).filter(h=>h.object.visible).slice(0,3);console.log('h a',a,'y',y,hs.map(h=>h.object.name+'@'+(h.distance*2).toFixed(1)).join(' '));}}
for(const [r,a] of [[3,0],[8,1],[12,2],[16,3],[18,4],[20,5],[5,4]]){const o=toW(new T.Vector3(Math.cos(a)*r,24.5,Math.sin(a)*r));const d=toW(new T.Vector3(Math.cos(a)*r,0,Math.sin(a)*r)).sub(o).normalize();rc.set(o,d);const hs=rc.intersectObject(inner,true).filter(h=>h.object.visible).slice(0,3);console.log('down r',r,a,hs.map(h=>h.object.name+'@y'+(24.5-h.distance*2).toFixed(1)).join(' '));}
for(const a of [1.2,2.0,2.75,3.3,3.85,4.4,5.0,5.6,6.1]){for(const r of [37,39,41]){const o=toW(new T.Vector3(Math.cos(a)*r,60,Math.sin(a)*r));const d=toW(new T.Vector3(Math.cos(a)*r,0,Math.sin(a)*r)).sub(o).normalize();rc.set(o,d);const hs=rc.intersectObject(inner,true).filter(h=>h.object.visible).slice(0,2);console.log('rim',a,r,hs.map(h=>h.object.name+'@y'+(60-h.distance*2).toFixed(1)).join(' '));}}
const pup=inner.userData.whales[1];let n=0;pup.traverse(o=>{if(o.isMesh||o.isLine)n++;});console.log('pup drawables',n, pup.children.map(c=>c.name+':'+c.type).join(' '));
const wl=inner.getObjectByName('swamp-underground-waterline');console.log('water',wl.type,wl.material.type,wl.material.transparent,wl.material.opacity,wl.renderOrder, wl.position.y);
