// Which visible mesh actually paints pixel (x,y) in the old-town "roofs" view? Hide candidates one by one.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const [X,Y]=JSON.parse(process.argv[2]||'[1000,300]');
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage({viewport:{width:1400,height:900}});await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(6500);
const r=await p.evaluate(([X,Y])=>{const t=window.__tm,T=t.THREE;let c;t.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)c=o;});t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.45;
const L=v=>c.localToWorld(new T.Vector3(...v));t.camera.position.copy(L([-38,14,26]));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(L([-52,9,2]));t.camera.fov=50;t.camera.far=4000;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);t.distanceCulling?.update(3);
const cv=t.renderer.domElement,W=cv.width,H=cv.height,px=Math.round(X/1400*W),py=Math.round(Y/900*H);
const read=()=>{t.renderer.render(t.scene,t.camera);const g=document.createElement('canvas');g.width=W;g.height=H;const x=g.getContext('2d');x.drawImage(cv,0,0);return [...x.getImageData(px,py,1,1).data].slice(0,3);};
const base=read();const vis=o=>{while(o){if(!o.visible)return false;o=o.parent;}return true;};
const ndc=new T.Vector2(X/1400*2-1,-(Y/900*2-1));const cands=[];
t.scene.traverse(o=>{if(!o.isMesh||!vis(o))return;const box=new T.Box3().setFromObject(o);if(box.isEmpty())return;const pts=[];for(const a of [box.min,box.max])for(const b2 of [box.min,box.max])for(const d of [box.min,box.max])pts.push(new T.Vector3(a.x,b2.y,d.z).project(t.camera));
 const xs=pts.map(v=>v.x),ys=pts.map(v=>v.y),zs=pts.map(v=>v.z);if(Math.min(...xs)<=ndc.x&&Math.max(...xs)>=ndc.x&&Math.min(...ys)<=ndc.y&&Math.max(...ys)>=ndc.y&&Math.min(...zs)<1)cands.push(o);});
const hits=[];for(const o of cands){o.visible=false;const col=read();o.visible=true;const d=Math.abs(col[0]-base[0])+Math.abs(col[1]-base[1])+Math.abs(col[2]-base[2]);if(d>20){const chain=[];let a=o;while(a&&chain.length<4){chain.push(a.name||'('+a.type+')');a=a.parent;}const m=Array.isArray(o.material)?o.material[0]:o.material;const g=o.geometry,vc=g.attributes.color;let vcs=null;if(vc){const cols=new Map();for(let i=0;i<vc.count;i++){const k=[vc.getX(i),vc.getY(i),vc.getZ(i)].map(v=>v.toFixed(2)).join(',');cols.set(k,(cols.get(k)||0)+1);}vcs=[...cols].sort((a,b)=>b[1]-a[1]).slice(0,6);}const mp=m?.map;let mapAvg=null;if(mp?.image){const q=document.createElement('canvas');q.width=4;q.height=4;q.getContext('2d').drawImage(mp.image,0,0,4,4);mapAvg=[...q.getContext('2d').getImageData(0,0,1,1).data].slice(0,3);}hits.push({holyGeo:!!g.userData.holyOldTown,done:!!o.userData.holyOldTownDone,vcs,mapAvg,mapIsCanvas:!!mp?.isCanvasTexture,chain,after:col,type:m?.type,color:m?.color?'#'+m.color.getHexString():null,map:!!m?.map,vc:!!m?.vertexColors,outline:!!o.userData.isOutline,side:m?.side,trans:m?.transparent,op:m?.opacity,verts:o.geometry.attributes.position.count});}}
return {base,cands:cands.length,hits};},[X,Y]);
console.log(JSON.stringify(r,null,1));}finally{await b.close();}
