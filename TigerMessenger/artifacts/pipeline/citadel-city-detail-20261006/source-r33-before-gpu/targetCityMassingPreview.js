import * as THREE from 'three';

const DEFAULT_PLATFORMS=[
 {id:'old-city-platform',center:[-55,9],radii:[31,30],height:17},
 {id:'new-city-platform',center:[74,33],radii:[29,37],height:12},
 {id:'new-city-plaza',center:[62,76],radii:[30,22],height:3},
];
/** Detached proportion proxies only. No WFC, collision, saved city, production
 * prop replacement or surface validation. Platform y values are caller claims.
 * Returns owned geometry/materials with dispose(), safe to discard wholesale. */
export function createTargetCityMassingPreview({platforms=DEFAULT_PLATFORMS,seed=314159,core=.7,variant='v1'}={}){
 if(!Number.isFinite(core)||core<=0||core>.7)throw new Error('preview core must be in (0,.7]');
 if(!['v1','original-1','stepped-2','elliptical-3','facing-4'].includes(variant))throw new Error('unknown massing variant');
 const facing=variant==='facing-4',elliptical=variant==='elliptical-3'||facing,stepped=variant==='stepped-2'||elliptical;
 const group=new THREE.Group();group.name='citadel-target-city-massing-preview';group.userData={previewOnly:true,noColliders:true,notWFC:true,seed,variant};
 const placements=[],rejected=[],materials=new Map(),geometries=new Set();
 const palette={old:0xdca37b,tower:0xe8cda0,new:0xc6d9e4,dome:0x547b9a,stair:0xd8d0b8,landmark:0xc49763};
 let randomState=seed>>>0;const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 const platform=id=>{const p=platforms.find(v=>v.id===id);if(!p||!p.center?.every(Number.isFinite)||!p.radii?.every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(p.height))throw new Error(`invalid platform ${id}`);return p;};
 const material=kind=>{if(!materials.has(kind))materials.set(kind,new THREE.MeshLambertMaterial({color:palette[kind]}));return materials.get(kind);};
 const add=(id,p,x,z,w,d,h,kind,role='building-proxy',baseY=p.height,shape='box')=>{
  const maxNorm=Math.max(...[-1,1].flatMap(sx=>[-1,1].map(sz=>Math.hypot((x+sx*w/2-p.center[0])/p.radii[0],(z+sz*d/2-p.center[1])/p.radii[1]))));
  if(maxNorm>core+1e-9){rejected.push({id,platform:p.id,reason:'footprint exceeds core ellipse',maxNorm,core});return null;}
  const geo=shape==='dome'?new THREE.SphereGeometry(w/2,16,8,0,Math.PI*2,0,Math.PI/2):new THREE.BoxGeometry(w,h,d);geometries.add(geo);
  const mesh=new THREE.Mesh(geo,material(kind));mesh.name=id;mesh.position.set(x,shape==='dome'?baseY:baseY+h/2,z);mesh.userData={previewOnly:true,noColliders:true,stableId:id,platformId:p.id,role};group.add(mesh);
  placements.push({id,platform:p.id,role,position:[x,baseY,z],size:[w,h,d],maxNorm,withinCore:true,shape,assumedPlatformY:p.height});return mesh;
 };
 const old=platform('old-city-platform');
 // The wide centre row uses the ellipse's available span; outer rows narrow.
 if(elliptical){
  const widths=[30.8,37.8,42,37.8,30.8],counts=[5,7,7,7,5];
  for(let row=0;row<5;row++)for(let col=0;col<counts[row];col++){
   if(row===1&&col===3)continue;
   const x=old.center[0]+(col-(counts[row]-1)/2)*(widths[row]-5.2)/(counts[row]-1),z=old.center[1]+(row-2)*6.1;
   const h=4.5+(4-row)*.85+random()*2.8,baseY=old.height+(row<2?8:row<4?4:0);
   if(baseY>old.height)add(`massing-old-support-${row}-${col}`,old,x,z,5.2,4.9,baseY-old.height,'stair','support-proxy',old.height);
   add(`massing-old-house-${row}-${col}`,old,x,z,5.2,4.9,h,'old','building-proxy',baseY);
  }
 }else{
 // Dense stepped roofline; a clear narrow lane is reserved near the tower.
 for(let row=0;row<5;row++)for(let col=0;col<5;col++){
  if(row===1&&col===2)continue;
  const x=old.center[0]+(col-2)*6.4,z=old.center[1]+(row-2)*6.1;
  const h=4.5+(4-row)*.85+random()*2.8;
  const baseY=old.height+(stepped?(row<2?8:row<4?4:0):0);
  if(baseY>old.height)add(`massing-old-support-${row}-${col}`,old,x,z,5.2,4.9,baseY-old.height,'stair','support-proxy',old.height);
  add(`massing-old-house-${row}-${col}`,old,x,z,5.2,4.9,h,'old','building-proxy',baseY);
 }
 }
 add('massing-old-landmark-tower',old,old.center[0],old.center[1]-6.1,3.2,3.2,stepped?33:23,'tower','fine-tower-proxy');
 const city=platform('new-city-platform'),cx=city.center[0],cz=city.center[1];
 if(stepped){
  add('massing-new-plinth',city,cx,cz-3,32,18,3,'new','plinth-proxy');
  add('massing-new-central-support',city,cx,cz-5,15,12,3,'stair','support-proxy',city.height+3);
  add('massing-new-central',city,cx,cz-5,15,12,13,'new','central-hall-proxy',city.height+6);
  add('massing-new-blue-dome',city,cx,cz-5,11,11,5.5,'dome','blue-dome-proxy',city.height+19,'dome');
  for(const side of [-1,1]){
   add(`massing-new-wing-support-${side}`,city,cx+side*11,cz+5,7,8,6,'stair','support-proxy');
   add(`massing-new-wing-${side}`,city,cx+side*11,cz+5,7,8,7,'new','wing-proxy',city.height+6);
  }
 }else{
  add('massing-new-plinth',city,cx,cz-4,25,23,3,'new','plinth-proxy');
  add('massing-new-central',city,cx,cz-8,15,12,13,'new','central-hall-proxy',city.height+3);
  add('massing-new-blue-dome',city,cx,cz-8,11,11,5.5,'dome','blue-dome-proxy',city.height+16,'dome');
  for(const side of [-1,1])add(`massing-new-wing-${side}`,city,cx+side*9,cz+1,7,9,7,'new','wing-proxy',city.height+3);
 }
 // Risers are proportion proxies, not a route collider or approved slope.
 for(let i=0;i<12;i++)add(`massing-new-stair-${i}`,city,cx,cz+(stepped?18:14)-i*1.1,5,1.12,(stepped?.5:.25)*(i+1),'stair','stair-proxy');
 const plaza=platform('new-city-plaza');
 add('massing-statue-reservation',plaza,plaza.center[0]-6,plaza.center[1],3,3,6,'landmark','statue-placeholder-not-original');
 add('massing-horse-reservation',plaza,plaza.center[0]+6,plaza.center[1],7,4,6,'landmark','horse-placeholder-not-original');
 const connectionPreview=stepped?{status:'unbuilt-connection-endpoints-only',from:[cx,city.height,cz+21],to:[plaza.center[0],plaza.height,plaza.center[1]-12],heightDrop:city.height-plaza.height}:null;
 if(stepped){
  add('massing-city-route-endpoint',city,cx,cz+21,2,2,.3,'stair','route-endpoint-only');
  add('massing-plaza-route-endpoint',plaza,plaza.center[0],plaza.center[1]-12,2,2,.3,'stair','route-endpoint-only');
 }
 // Apply only to detached city proxies. Do not rotate the plaza landmarks.
 if(facing){
  const rejectedIds=new Set();
  for(const p of placements){
   const yaw=p.platform==='old-city-platform'?Math.PI/4:p.platform==='new-city-platform'?-55*Math.PI/180:0;
   const platformData=platform(p.platform),[px,pz]=platformData.center,c=Math.cos(yaw),s=Math.sin(yaw),rotate=(x,z)=>[px+c*(x-px)+s*(z-pz),pz-s*(x-px)+c*(z-pz)];
   const [x,y,z]=p.position;p.sourcePosition=[...p.position];
   p.rotatedFootprint=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sz])=>{const q=rotate(x+sx*p.size[0]/2,z+sz*p.size[2]/2);return [q[0],y,q[1]];});
   const q=rotate(x,z);p.position=[q[0],y,q[1]];p.yaw=yaw;
   p.maxNorm=Math.max(...p.rotatedFootprint.map(q=>Math.hypot((q[0]-px)/platformData.radii[0],(q[2]-pz)/platformData.radii[1])));p.withinCore=p.maxNorm<=core+1e-9;
   if(!p.withinCore){rejectedIds.add(p.id);rejected.push({...p,reason:'rotated footprint exceeds core ellipse',core});}
  }
  // Reject dependencies together so neither a floating house nor orphaned
  // support is presented as a viable placement.
  const groups=[];
  for(const p of placements)if(p.id.startsWith('massing-old-support-'))groups.push([p.id,p.id.replace('support','house')]);
  for(const side of [-1,1])groups.push([`massing-new-wing-support-${side}`,`massing-new-wing-${side}`]);
  groups.push(['massing-new-plinth','massing-new-central-support','massing-new-central','massing-new-blue-dome']);
  let dirty=true;while(dirty){dirty=false;for(const ids of groups)if(ids.some(id=>rejectedIds.has(id)))for(const id of ids)if(!rejectedIds.has(id)&&placements.some(p=>p.id===id)){rejectedIds.add(id);dirty=true;const p=placements.find(p=>p.id===id);rejected.push({...p,reason:'dependent support/building rejected',dependencyGroup:ids});}}
  for(let i=placements.length-1;i>=0;i--){const p=placements[i],mesh=group.getObjectByName(p.id);if(rejectedIds.has(p.id)){if(mesh){mesh.removeFromParent();mesh.geometry.dispose();geometries.delete(mesh.geometry);}placements.splice(i,1);}else if(mesh){mesh.position.x=p.position[0];mesh.position.z=p.position[2];mesh.rotation.y=p.yaw;}}
  const cityEndpoint=placements.find(p=>p.id==='massing-city-route-endpoint');if(connectionPreview){connectionPreview.from=cityEndpoint?[...cityEndpoint.position]:null;connectionPreview.status='unbuilt-connection-endpoints-only';connectionPreview.cityEndpointRejected=!cityEndpoint;}
 }
 const report={revision:facing?'city-massing-preview-4':elliptical?'city-massing-preview-3':stepped?'city-massing-preview-2':'city-massing-preview-1',variant,previewOnly:true,noColliders:true,notWFC:true,seed,core,connectionPreview,supportProxies:placements.filter(p=>p.role==='support-proxy').map(p=>p.id),placements,rejected,platforms:platforms.map(p=>({...p,center:[...p.center],radii:[...p.radii]})),counts:{accepted:placements.length,rejected:rejected.length},limitations:['Proxy heights assume supplied platform levels; no final surface support or route validation.','Intentional central hall/plinth overlap models massing only; not final modular assembly.','Statue and horse reservations do not replace original props.','City-to-plaza connection and route slope remain to be designed.']};
 group.userData.placementReport=report;
 return {group,report,dispose(){group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();group.clear();}};
}
