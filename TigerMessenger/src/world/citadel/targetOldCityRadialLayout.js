import * as T from 'three';
import {createTargetStreetDressing} from './targetStreetDressing.js';

export const TARGET_OLD_CITY_RADIAL_VERSION='target-old-city-14-radial-streets';
const C=[-1,-2.8],D=Math.PI/180;
// Uneven angular bays and radii are authored against the existing fifteen IDs.
// The gaps at 0/-120/+120 degrees are actual radial streets, not empty labels.
const PLAN=[
 ['house-2--1-0',-151,9.55,'inner'],['house-1--1-0',-86,10.0,'inner'],
 ['house-1--1-1',-32,9.85,'inner'],['house-2-1-0',33,9.60,'inner'],
 ['house-1-1-1',87,10.05,'inner'],['house-2--1-1',153,9.8,'inner'],
 ['house-0--1-2',-161,17.3,'outer'],['house-1--1-2',-129,17.7,'outer'],
 ['house-0--1-1',-98,17.3,'outer'],['house-0--1-0',-62,17.55,'outer'],
 ['house-0-1-0',-33,17.6,'outer'],['house-0-1-1',33,17.2,'outer'],
 ['house-0-1-2',64,17.75,'outer'],['house-1-1-2',115,17.25,'outer'],
 ['house-1-1-0',153,17.6,'outer'],
];
const polar=(r,a,stretch=.8)=>[C[0]+Math.sin(a)*r,C[1]+Math.cos(a)*r*stretch];
const streetHeight=a=>.3+.2*Math.round(20*T.MathUtils.clamp((Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))/D-70)/45,0,1));
function polygon(x,z,w,d,yaw){return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sz])=>[x+Math.cos(yaw)*sx*w/2+Math.sin(yaw)*sz*d/2,z-Math.sin(yaw)*sx*w/2+Math.cos(yaw)*sz*d/2]);}
function boundsPolygon(points){const x=points.map(p=>p[0]),z=points.map(p=>p[1]),a=Math.min(...x),b=Math.max(...x),c=Math.min(...z),d=Math.max(...z);return[[a,c],[b,c],[b,d],[a,d]];}
function transformPoint(p,old,next,yaw){const x=p[0]-old[0],z=p[2]-old[2];return[next[0]+Math.cos(yaw)*x+Math.sin(yaw)*z,next[1]+p[1]-old[1],next[2]-Math.sin(yaw)*x+Math.cos(yaw)*z];}

/** Reuse the actual authored house groups and tower meshes; retire only the
 * superseded rectangular terraces, central flight and stale dressing. The
 * returned owners remain inside the old-city factory's disposal transaction. */
export function rebuildTargetOldCityRadialLayout({group,report,mats,geometries,streetDressing}){
 const before=JSON.parse(JSON.stringify({houses:report.houses,entry:report.entry,exits:report.exits,stairs:report.stairs,bounds:report.bounds}));
 const routes=[],supports=[],changes=[],privateArcades=[];
 function mesh(name,geometry,mat='stone',parent=group){geometries.add(geometry);const m=new T.Mesh(geometry,mats[mat]);m.name=name;m.castShadow=m.receiveShadow=true;m.userData.preserveCitadelMaterials=true;parent.add(m);return m;}
 function box(name,w,h,d,x,y,z,mat='stone',yaw=0,parent=group){const m=mesh(name,new T.BoxGeometry(w,h,d),mat,parent);m.position.set(x,y,z);m.rotation.y=yaw;return m;}
 function retire(object){object.removeFromParent();object.traverse(m=>{if(m.isMesh&&geometries.delete(m.geometry))m.geometry.dispose();});}
 for(const object of [...group.children])if(/^terrace-|^central-step-|^upper-street-landing$/.test(object.name)||object.userData.targetSharedResidentialFloor||object.name==='old-city-upper-left-street-infill')retire(object);
 streetDressing.dispose();
 report.footprints=report.footprints.filter(f=>f.id.startsWith('house-')||['gate-approach','old-city-front-open-gate','old-city-high-tower','tower-axial-court'].includes(f.id));
 report.walkable=report.walkable.filter(p=>p.id==='gate-approach');
 function footprint(id,points,top,extra={}){report.footprints.push({id,polygon:boundsPolygon(points),floorY:0,roofY:top,support:true,...extra});}
 function publicMesh(m){m.userData.targetWalkable=true;report.walkable.push({id:m.name});return m;}
 function slab(id,points,height,{publicFloor=false,material='stone'}={}){
  // Closed polygonal prism; top winding is independent of input orientation.
  const shape=new T.Shape(points.map(p=>new T.Vector2(p[0],-p[1])));
  const g=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:1});g.rotateX(-Math.PI/2);
  const m=mesh(id,g,material);if(publicFloor)publicMesh(m);footprint(id,points,height,{walkable:publicFloor});return m;
 }
 function stairPath(id,points,width=2.6,parent=group){
  const route={id,width,points:points.map(p=>[...p]),surfaces:[],maxRise:0,minimumTread:Infinity,publicAccess:true};
  for(let j=1;j<points.length;j++){
   const a=points[j-1],b=points[j],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz),rise=b[1]-a[1],n=Math.max(1,Math.ceil(Math.abs(rise)/.2)),tread=len/n;
   if(len<1e-6)continue;
   for(let k=0;k<n;k++){
    const t=(k+.5)/n,x=a[0]+dx*t,z=a[2]+dz*t,top=a[1]+rise*(rise>=0?(k+1)/n:k/n);
    const m=publicMesh(box(`${id}-tread-${j}-${k}`,width,Math.max(.1,top),tread+.025,x,Math.max(.1,top)/2,z,'trim',Math.atan2(dx,dz),parent));
    route.surfaces.push({id:m.name,point:[x,top,z],width,length:tread+.025});
   }
   route.maxRise=Math.max(route.maxRise,Math.abs(rise)/n);route.minimumTread=Math.min(route.minimumTread,tread);
  }
  routes.push(route);return route;
 }
 // Keep every tower part's authored geometry, size, colour and vertical pose.
 const towerShift=[C[0],-4,C[1]+15.2];
 for(const object of group.children.filter(o=>o.name.startsWith('tower-')))object.position.add(new T.Vector3(...towerShift));
 publicMesh(group.getObjectByName('tower-axial-court-foundation'));
 const towerCourt=group.getObjectByName('tower-axial-court-foundation');geometries.delete(towerCourt.geometry);towerCourt.geometry.dispose();towerCourt.geometry=new T.BoxGeometry(6.2,4.3,6.4);geometries.add(towerCourt.geometry);towerCourt.position.y=2.15;
 for(const f of report.footprints.filter(f=>['old-city-high-tower','tower-axial-court'].includes(f.id))){f.polygon=f.polygon.map(([x,z])=>[x+towerShift[0],z+towerShift[2]]);f.roofY-=4;if(f.floorY)f.floorY-=4;}
 for(const window of report.towerWindows)window.y-=4;
 const placement=new Map();
 for(const[id,angle,radius,ring]of PLAN){
  const a=angle*D,placedRadius=radius+(ring==='inner'?-.8:1.2),[x,z]=polar(placedRadius,a,ring==='inner'?.86:.8),h=report.houses.find(h=>h.id===id),old=[...h.position],floor=ring==='inner'?4.3:streetHeight(a),yaw=Math.atan2(C[0]-x,C[1]-z),next=[x,floor,z];
  const root=group.getObjectByName(id);root.position.fromArray(next);root.rotation.y=yaw;root.userData.radialPlot={center:[...C],angleDegrees:angle,radius:placedRadius,ring,yaw};
  const base=group.getObjectByName(id+'-base');base.position.fromArray(transformPoint(base.position.toArray(),old,next,yaw));base.rotation.y=yaw;publicMesh(base);
  const fp=report.footprints.find(f=>f.id===id),originalWidth=Math.max(...fp.polygon.map(p=>p[0]))-Math.min(...fp.polygon.map(p=>p[0]));
  // Axis-aligned conservative editing reserve is deliberately separate from
  // the oriented building footprint. Existing roof-WFC validates reserves;
  // exact mesh/route tests validate their occupants and real walk corridors.
  const occupied=polygon(x,z,originalWidth,5.1,yaw),raw=boundsPolygon(occupied),reserve=boundsPolygon([...raw,...polygon(x,z,originalWidth,5.1,0)]),dy=floor-old[1];
  Object.assign(fp,{polygon:reserve,floorY:floor,roofY:fp.roofY+dy,supportedBy:id+'-radial-podium',orientedPolygon:occupied,plotYaw:yaw,plotKind:'axis-aligned-edit-reserve-for-oriented-building'});
  h.position=next;h.yaw=yaw;h.ring=ring;h.radialAngle=angle;h.roofY+=dy;
  if(h.terrace){h.terrace.topY+=dy;h.terrace.polygon=h.terrace.polygon.map(([px,pz])=>{const p=transformPoint([px,old[1],pz],old,next,yaw);return[p[0],p[2]];});}
  for(const w of report.facadeWindows.filter(w=>w.houseId===id)){w.position=transformPoint(w.position,old,next,yaw);const n=w.normal;w.normal=[Math.cos(yaw)*n[0]+Math.sin(yaw)*n[2],0,-Math.sin(yaw)*n[0]+Math.cos(yaw)*n[2]];}
  for(const arc of report.residentialArcades.filter(v=>v.houseId===id)){
   const openings=arc.openings.map(o=>({front:transformPoint([o.centerX,o.floorY,o.frontZ],old,next,yaw),back:transformPoint([o.centerX,o.floorY,o.backZ],old,next,yaw),width:o.width,springY:o.springY+dy,crownY:o.crownY+dy}));
   privateArcades.push({...arc,openings,sideConnections:[],gallery:{...arc.gallery,topY:arc.gallery.topY+dy},previousSideLinksRetired:true});
  }
  const podiumPoints=polygon(x,z,originalWidth+.25,5.38,yaw),podium=slab(id+'-radial-podium',podiumPoints,floor);
  supports.push({houseId:id,mesh:podium.name,top:floor,polygon:podiumPoints,scope:'factory podium; actual frozen-terrain seating remains integration-owned'});
  const arcade=report.residentialArcades.find(v=>v.houseId===id);
  let doorwayOffset=arcade?arcade.openings[0].centerX-old[0]:0;
  if(!arcade){
   // Existing upper street houses gain a real entrance void; their upper
   // volume, roof, palette and editor-owned wall mesh remain the same.
   const wall=root.getObjectByName(id+'-walls'),w=h.volumes[0].w,height=h.height,parts=[];
   const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(-w/2,height);shape.lineTo(w/2,height);shape.lineTo(w/2,0);shape.lineTo(.7,0);shape.lineTo(.7,1.85);shape.absarc(0,1.85,.7,0,Math.PI,false);shape.lineTo(-.7,0);shape.closePath();
   const frontWall=new T.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:false,curveSegments:12});frontWall.translate(0,0,2.11);parts.push(frontWall);
   for(const [ww,hh,dd,xx,yy,zz]of[[.24,height,4.7,-w/2+.12,height/2,0],[.24,height,4.7,w/2-.12,height/2,0],[w,height,.24,0,height/2,-2.23],[w,.18,4.7,0,height-.09,0]]){const g=new T.BoxGeometry(ww,hh,dd);g.translate(xx,yy,zz);parts.push(g);}
   const vertices=[];for(const part of parts){const g=part.index?part.toNonIndexed():part;vertices.push(...g.attributes.position.array);if(g!==part)g.dispose();part.dispose();}
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();geometries.delete(wall.geometry);wall.geometry.dispose();wall.geometry=geometry;geometries.add(geometry);wall.position.set(0,0,0);h.bodyVariant='arched-door-street-house';
  }
  const front=transformPoint([old[0]+doorwayOffset,old[1]+.22,old[2]+2.44],old,next,yaw),join=ring==='inner'?polar(5.7,a,.86):polar(14.6,a,.8);
  // A level porch meets the existing 22cm plinth at the actual arch opening.
  const approach=front.map((v,i)=>i===1?floor:v),doorLanding=[approach[0]+Math.sin(yaw)*.85,floor,approach[2]+Math.cos(yaw)*.85],route=stairPath(id+'-front-threshold',[[join[0],floor,join[1]],doorLanding,approach],1.25);
  route.doorway={position:front,width:arcade?arcade.openings[0].width:1.4,plinthRise:.22};
  placement.set(id,{old,next,yaw,dy});changes.push({id,before:{position:old,yaw:0},after:{position:next,yaw,roofY:h.roofY},ring,angleDegrees:angle,radius:placedRadius});
 }
 // Ring walks have real finite-width top faces and closed supporting sides.
 // The outer route climbs in short stone risers on the two rear flanks.
 for(const[id,r,stretch,heightAt]of[['old-inner-ring-street',4.9,.86,()=>4.3],['old-outer-ring-street',14.6,.8,streetHeight]]){
  const n=240,vertices=[],routePoints=[];
  const emit=(...v)=>vertices.push(...v.flat());
  for(let i=0;i<n;i++){
   const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,y=heightAt((a+b)/2),inner=r-1.30,outer=r+1.30;
   const p=[polar(inner,a,stretch),polar(outer,a,stretch),polar(outer,b,stretch),polar(inner,b,stretch)],v=p.map(([x,z])=>[x,y,z]),bottom=p.map(([x,z])=>[x,0,z]);
   emit(v[0],v[1],v[2],v[0],v[2],v[3]);
   for(let k=0;k<4;k++){const l=(k+1)%4;emit(v[k],v[l],bottom[l],v[k],bottom[l],bottom[k]);}
   const q=polar(r,(a+b)/2,stretch);routePoints.push([q[0],y,q[1]]);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();publicMesh(mesh(id,geometry,'trim'));
  routes.push({id,width:2.6,points:[...routePoints,routePoints[0]],closed:true,maxRise:id.includes('inner')?0:.2,publicAccess:true});
  footprint(id,[polar(r+1.3,-Math.PI/2,stretch),polar(r+1.3,0,stretch),polar(r+1.3,Math.PI/2,stretch),polar(r+1.3,Math.PI,stretch)],4.3,{walkable:true,annular:true});
 }
 for(const angle of[0,-120,120]){const a=angle*D,p=polar(14.6,a,.8),start=polar(13.7,a,.8),end=polar(6.2,a,.86),q=polar(4.9,a,.86);stairPath('old-radial-alley-'+angle,[[p[0],streetHeight(a),p[1]],[start[0],streetHeight(a),start[1]],[end[0],4.3,end[1]],[q[0],4.3,q[1]]],angle===0?3.2:2.5);}
 stairPath('old-entry-to-ring',[[0,.3,16.3],[0,.3,13.4],[C[0],.3,C[1]+14.6*.8]],3.2);
 stairPath('old-tower-court-link',[[C[0],4.3,C[1]+4.9*.86],[C[0],4.3,C[1]+2.4]],2.5);
 // Keep exact externally consumed bridge/feed/entry and upper-street anchors.
 stairPath('old-waterfront-public-street',[[0,.3,13.4],[6,.3,13.8],[11,.3,13.7],[19.8,.3,12.4]],2.0);
 stairPath('old-upper-anchor-link',[[0,8.3,-12.5],[C[0],8.3,-13],[C[0],4.3,C[1]-4.9*.86]],2.0);
 // The two already installed independent infill rooms move to the shoulder;
 // attached private rooms remain inside and move with their editable owner.
 const detachedInfill=[[-1,4.3,-17.7,Math.PI],[-23,.3,-3,Math.PI/2]];
 for(const mod of report.streetInfill.modules){
  if(mod.attachedTo){const p=placement.get(mod.attachedTo);mod.position=transformPoint(mod.position,p.old,p.next,p.yaw);mod.polygon=mod.polygon.map(([x,z])=>{const q=transformPoint([x,p.old[1],z],p.old,p.next,p.yaw);return[q[0],q[2]];});mod.roofY+=p.dy;mod.support.top+=p.dy;continue;}
  const i=mod.id.endsWith('-0')?0:1,[x,y,z,yaw]=detachedInfill[i],w=mod.width,d=mod.depth,root=new T.Group();root.name=mod.id+'-radial-room';root.position.set(x,y,z);root.rotation.y=yaw;group.add(root);
  box(mod.id+'-wall',w,mod.height,d,0,mod.height/2,0,mod.colour,0,root);
  const roofShape=new T.ConeGeometry(1,1,4);roofShape.rotateY(Math.PI/4);roofShape.scale((w+.16)/Math.SQRT2,.65,(d+.16)/Math.SQRT2);mesh(mod.id+'-hip',roofShape,'roof',root).position.y=mod.height+.325;
  for(const xx of[-1,1]){box(mod.id+'-window-reveal',.65,.79,.08,xx,mod.height*.55,d/2+.03,'trim',0,root);box(mod.id+'-window-pane',.48,.60,.05,xx,mod.height*.55,d/2+.08,'glass',0,root);}
  const points=polygon(x,z,w+.25,d+.25,yaw);slab(mod.id+'-radial-support',points,y);mod.position=[x,y,z];mod.yaw=yaw;mod.roofY=y+mod.height+.65;mod.polygon=points;mod.support={mesh:mod.id+'-radial-support',top:y};
 }
 report.streetInfill.existingPlotsUnchanged=false;report.streetInfill.publicRoutesChanged=true;report.streetInfill.windows=[];
 report.streetArcades={selection:'retained house-owned through arcades; old row-side connections removed',groups:[],links:[],sharedFloors:[],publicGeometryChanged:true,terrainChanged:false,publicNavigationInstalled:false,galleryAccessClaimed:false};report.residentialArcades=privateArcades;
 // Gardens and lamps now sit at sampled route/tower landings, not old rows.
 for(const [i,x,z]of [[0,-5.2,12.7],[1,16.5,14.9]])slab('old-waterfront-garden-pocket-'+i,polygon(x,z,1.8,1.8,0),.3);
 const dressing=createTargetStreetDressing({plants:[[-3.6,4.3,-1,.7,false],[2,4.3,-3.8,.65,false],[-5.2,.3,12.7,.65,false],[16.5,.3,14.9,.65,false]],lamps:[[C[0],7.25,C[1]+1.15],[-2.1,2.45,14],[3,2.45,13.4]],lightLimit:3});group.add(dressing.group);report.streetDressing=dressing.report;
 report.version=TARGET_OLD_CITY_RADIAL_VERSION;report.stairs={from:[C[0],.3,C[1]+14.6*.8],to:[C[0],4.3,C[1]+4.9*.86],steps:20,rise:.2,tread:(13.7*.8-6.2*.86)/20,width:3.2};
 report.layoutRedistribution={target:'clipboard-051b3cbc-fd0f-4279-8b50-2fde3ab516d2',method:'existing houses rearranged around tower; uneven broken radial plots, two curved public streets, three radial stair alleys',towerPosition:[C[0],4.3,C[1]],towerMoved:true,existingPublicRoutesChanged:true,externalAnchorsPreserved:true,terrainChanged:false,changes};
 report.radialLayout={version:TARGET_OLD_CITY_RADIAL_VERSION,center:[...C],routes,supports,rollbackLayout:'axial',sourceHouseCount:15,reusedHouseCount:15,ringHouseCounts:{inner:6,outer:9},actualGeometry:true,finiteNavigationVerified:false,continuousNavigationVerified:false,gpuVerified:false};
 report.validation.navigationInstalled=false;report.validation.surfaceSeated=false;
 function refresh(){group.updateWorldMatrix(true,true);const inv=group.matrixWorld.clone().invert(),bounds=new T.Box3();let meshes=0,triangles=0;group.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);if(o.isInstancedMesh){o.computeBoundingBox();bounds.union(o.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)));}else bounds.union(new T.Box3().setFromBufferAttribute(o.geometry.attributes.position).applyMatrix4(inv.clone().multiply(o.matrixWorld)));});report.bounds={min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new T.Vector3()).toArray()};report.performance={...report.performance,meshes,triangles,geometries:geometries.size};}
 refresh();
 // Wing completion remains post-placement and sampled; retained legacy API is
 // supplied below without touching the outer factory's root/terrain ownership.
  function completeWingStreets(options={}){
  if(typeof options.sampleSurface!=='function')throw new TypeError('OLD_WINGS_REQUIRE_ACTUAL_SURFACE_AND_PROTECTIONS');
  const previous=report.wingStreets,owned=new Set(),wing=new T.Group();wing.name='old-city-radial-shore-wing-streets';wing.userData.targetProtectedArchitecture=true;
  const oldWalkCount=report.walkable.length,oldRouteCount=routes.length;
  const modules=[],rejected=[];
  group.updateWorldMatrix(true,true);const cityInverse=group.matrixWorld.clone().invert(),obstacles=[],seen=new Set();
  for(const source of[group,...(options.collisionGroups||[])]){
   if(!source?.isObject3D)throw new TypeError('OLD_WING_COLLISION_GROUP');source.updateWorldMatrix(true,true);source.traverse(m=>{
    if(!m.isMesh||seen.has(m)||!m.geometry?.attributes.position)return;seen.add(m);
    for(let p=m;p&&p!==source;p=p.parent)if(!p.visible)return;
    const matrix=cityInverse.clone().multiply(m.matrixWorld),geometry=m.geometry,position=geometry.attributes.position,index=geometry.index;
    for(let instance=0;instance<(m.isInstancedMesh?m.count:1);instance++){
     const transform=matrix.clone();if(m.isInstancedMesh){const im=new T.Matrix4();m.getMatrixAt(instance,im);transform.multiply(im);}
     if(Math.abs(transform.determinant())<1e-12)continue;
     const vertices=Array.from({length:position.count},(_,i)=>new T.Vector3().fromBufferAttribute(position,i).applyMatrix4(transform));
     obstacles.push({name:m.name,vertices,index,box:new T.Box3().setFromPoints(vertices),start:geometry.drawRange.start,end:Math.min(index?.count??position.count,geometry.drawRange.start+geometry.drawRange.count)});
    }
   });
  }
  let triangleTests=0;
  function collides(center,yaw,width,height,depth){
   const local=new T.Matrix4().makeRotationY(yaw).setPosition(...center),inverse=local.clone().invert(),box=new T.Box3(new T.Vector3(-width/2,0,-depth/2),new T.Vector3(width/2,height,depth/2)),broad=box.clone().applyMatrix4(local),tri=new T.Triangle();
   for(const o of obstacles){if(!broad.intersectsBox(o.box))continue;for(let i=o.start;i+2<o.end;i+=3){for(const[v,j]of[[tri.a,0],[tri.b,1],[tri.c,2]])v.copy(o.vertices[o.index?o.index.getX(i+j):i+j]).applyMatrix4(inverse);triangleTests++;if(box.intersectsTriangle(tri))return o.name;}}
   return null;
  }
  // The current installed outer wings are superseded, not left as a second
  // rectangular layout. New locations use the four clear angular street gaps.
  for(const [pair,angle]of[-113,-48,53,134].entries()){
   const a=angle*D,[cx,cz]=polar(26,a,.8),yaw=Math.atan2(C[0]-cx,C[1]-cz),plans=[];
   for(const side of[-1,1]){const x=cx+Math.cos(yaw)*side*2.15,z=cz-Math.sin(yaw)*side*2.15,poly=polygon(x,z,3.5,3.3,yaw),samples=poly.concat([[x,z]]).map(([px,pz])=>{const v=options.sampleSurface(px,pz);return{x:px,z:pz,height:typeof v==='number'?v:v?.height};});plans.push({id:`old-radial-wing-${pair}-${side}`,x,z,polygon:poly,samples});}
   const heights=plans.flatMap(p=>p.samples.map(s=>s.height));if(heights.some(v=>!Number.isFinite(v))||Math.max(...heights)-Math.min(...heights)>1.25){rejected.push({pair,reason:{kind:heights.some(v=>!Number.isFinite(v))?'missing-actual-support':'unsupported-height-spread'}});continue;}
   const y=Math.max(.15,Math.max(...heights)+.05);
   // Reserve/protection intersection is conservative; do not turn supplied
   // bridge/rail footprints into an approximate terrain avoidance heuristic.
   const protectedBox=(options.protectedFootprints||[]).some(p=>plans.some(q=>{const a=boundsPolygon(p.polygon),b=boundsPolygon(q.polygon);return a[0][0]<b[2][0]&&a[2][0]>b[0][0]&&a[0][1]<b[2][1]&&a[2][1]>b[0][1];}));
   if(protectedBox){rejected.push({pair,reason:{kind:'protected-footprint'}});continue;}
   let obstacle=plans.map(p=>collides([p.x,y+.12,p.z],yaw,3.65,5.6,3.45)).find(Boolean);
   const start=polar(14.6,a,.8),ledge=polar(16.0,a,.8),end=[cx+Math.sin(yaw)*2.25,cz+Math.cos(yaw)*2.25],rise=y+.10-streetHeight(a),run=Math.hypot(end[0]-start[0],end[1]-start[1]),stepCount=Math.max(1,Math.ceil(Math.abs(rise)/.2)),flatRun=Math.hypot(ledge[0]-start[0],ledge[1]-start[1]);
   if((run-flatRun)/stepCount<.28){rejected.push({pair,reason:{kind:'approach-too-steep',minimumTread:(run-flatRun)/stepCount}});continue;}
   // Finite actual-triangle body columns reserve the new gap alley before any
   // geometry is published. Rail/bridge/other-city obstacles are caller-owned.
   for(let i=0;!obstacle&&i<=Math.ceil(run/.2);i++){const t=i/Math.ceil(run/.2),x=T.MathUtils.lerp(start[0],end[0],t),z=T.MathUtils.lerp(start[1],end[1],t),floor=T.MathUtils.lerp(streetHeight(a),y+.10,Math.max(0,(t-flatRun/run)/(1-flatRun/run)));obstacle=collides([x,floor+.45,z],Math.atan2(end[0]-start[0],end[1]-start[1]),.8,1.38,.24);}
   for(let i=0;!obstacle&&i<=24;i++){const offset=-2.15+4.3*i/24;obstacle=collides([end[0]+Math.cos(yaw)*offset,y+.55,end[1]-Math.sin(yaw)*offset],yaw,1.0,1.4,1.05);}
   if(obstacle){rejected.push({pair,reason:{kind:'actual-obstacle-triangle',mesh:obstacle}});continue;}
   for(const p of plans){const floor=y,colour=pair%2?'teal':'yellow',bottom=Math.min(...p.samples.map(s=>s.height))-.03,root=new T.Group();root.name=p.id;root.position.set(p.x,floor,p.z);root.rotation.y=yaw;wing.add(root);
    const start=geometries.size;
    box(p.id+'-footing',3.5,floor-bottom,3.3,0,(bottom-floor)/2,0,'stone',0,root);
    const roomFloor=box(p.id+'-floor',3.5,.1,3.3,0,.05,0,'trim',0,root);publicMesh(roomFloor);
    // Real narrow door in the front wall, with side/back wall and hipped cap.
    const shape=new T.Shape();shape.moveTo(-1.75,0);shape.lineTo(-1.75,4.8);shape.lineTo(1.75,4.8);shape.lineTo(1.75,0);shape.lineTo(.55,0);shape.lineTo(.55,1.7);shape.absarc(0,1.7,.55,0,Math.PI,false);shape.lineTo(-.55,0);shape.closePath();
    mesh(p.id+'-door',new T.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:false,curveSegments:8}),colour,root).position.z=1.43;
    for(const x of[-1.64,1.64])box(p.id+'-side',.22,4.8,3.3,x,2.4,0,colour,0,root);box(p.id+'-back',3.5,4.8,.22,0,2.4,-1.54,colour,0,root);
    const roof=new T.ConeGeometry(1,1,4);roof.rotateY(Math.PI/4);roof.scale(3.65/Math.SQRT2,.85,3.45/Math.SQRT2);mesh(p.id+'-roof',roof,'roof',root).position.y=5.225;
    for(const m of [...geometries].slice(start))owned.add(m);
    modules.push({id:p.id,position:[p.x,floor,p.z],polygon:p.polygon,yaw,colour,width:3.5,depth:3.3,height:4.8,supportSamples:p.samples,foundationMaximumHeight:floor-bottom,publicAccess:false,editable:false});
   }
   const beforeRoutes=new Set(geometries);
   stairPath('old-radial-wing-gap-'+pair,[[start[0],streetHeight(a),start[1]],[ledge[0],streetHeight(a),ledge[1]],[end[0],y+.1,end[1]]],1.8,wing);
   const porch=side=>[end[0]+Math.cos(yaw)*side*2.15,y+.1,end[1]-Math.sin(yaw)*side*2.15];
   stairPath('old-radial-wing-porch-'+pair,[porch(-1),porch(1)],1.15,wing);
   for(const g of geometries)if(!beforeRoutes.has(g))owned.add(g);
  }
  group.add(wing);const before={bounds:report.bounds,performance:report.performance};report.wingStreets={version:'old-radial-wing-streets-1',enabled:true,status:modules.length?'installed-candidate':'no-safe-pairs',modules,rejected,triangleTests,baseCityUnchanged:true,terrainChanged:false,gpuVerified:false,visualAccepted:false,collisionVerified:false,finiteApproachBodyChecked:true};refresh();let closed=false;
  return{group:wing,report:report.wingStreets,dispose(){if(closed)return;closed=true;wing.removeFromParent();for(const g of owned){geometries.delete(g);g.dispose();}wing.clear();report.walkable.length=oldWalkCount;routes.length=oldRouteCount;report.wingStreets=previous;Object.assign(report,before);}};
 }
 return{streetDressing:dressing,completeWingStreets,report:report.radialLayout};
}
