import * as THREE from 'three';
import { TARGET_NEW_CITY_MAIN_PALETTE } from './targetNewCityMain.js?revision=entry-r39';

// Same local frame as targetNewCityMain: origin at castle [74,12,33], yaw -55°.
// The lower endpoint maps to castle-local [62,3,64], north of the plaza props.
const yaw = -55 * Math.PI / 180;
const plazaDelta = [-12, 31];
const plazaLocal = [Math.cos(yaw) * plazaDelta[0] - Math.sin(yaw) * plazaDelta[1], -9,
  Math.sin(yaw) * plazaDelta[0] + Math.cos(yaw) * plazaDelta[1]];
export const TARGET_NEW_CITY_STAIR_ROUTE = Object.freeze([
  [0, 0, 12.96], [0, 0, 15], [0, -3, 21.6], [4, -3, 24.6],
  [11, -6, 26.1], [13, -6, 26.55], plazaLocal,
].map(p => Object.freeze(p)));
const triple = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const lerp = (a,b,t) => a.map((v,i) => v+(b[i]-v)*t);
const pointSegmentDistance = (p,a,b) => {
  const dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz),0,1);
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);
};

/** Authored reversible stair/building candidate. surfaceHeightAt is optional,
 * READ ONLY, and must return terrain Y in this module's local frame or null.
 * It audits rather than carves terrain or silently moves the approved stair. */
export function createTargetNewCityStairs({seed=20261006,palette={},route=TARGET_NEW_CITY_STAIR_ROUTE,
  width=6.2,maxRise=.25,foundationBottom=-10.2,surfaceHeightAt=null,includeHouses=true,houseOffsets={},housingProfile='stepped-flanks-v5'}={}) {
  if(!['stepped-flanks-v5','original'].includes(housingProfile))throw new TypeError('unknown housingProfile');
  if(!Array.isArray(route)||route.length<2||!route.every(triple))throw new TypeError('route must contain finite local triples');
  if(!Number.isFinite(width)||width<4||width>10||!Number.isFinite(maxRise)||maxRise<=0||maxRise>.3)throw new RangeError('invalid stair width/rise');
  if(!Number.isFinite(foundationBottom)||foundationBottom>=Math.min(...route.map(p=>p[1]))-.05)throw new RangeError('foundation must be below route');
  if(surfaceHeightAt!==null&&typeof surfaceHeightAt!=='function')throw new TypeError('surfaceHeightAt must be a function');
  if(!houseOffsets||typeof houseOffsets!=='object'||Array.isArray(houseOffsets)||Object.entries(houseOffsets).some(([id,p])=>!/^new-city-stair-house-[0-2]-(?:-1|1)$/.test(id)||!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw new TypeError('houseOffsets requires known house IDs and finite local XZ offsets');
  for(let i=1;i<route.length;i++)if(Math.hypot(route[i][0]-route[i-1][0],route[i][2]-route[i-1][2])<.1||route[i][1]>route[i-1][1]+1e-8)throw new RangeError('route must descend with nonzero horizontal segments');
  const colours={...TARGET_NEW_CITY_MAIN_PALETTE,rose:'#d79084',paving:'#d8ccb0',...palette};
  const group=new THREE.Group();group.name='citadel-target-new-city-stairs';group.userData.preserveCitadelMaterials=true;
  const gs=new Set(),ms=new Set(),footprints=[],walkSurfaces=[],houses=[],supportSamples=[];
  const materials=Object.fromEntries(Object.entries(colours).map(([key,color])=>{
    const m=new THREE.MeshStandardMaterial({color,roughness:.87});m.name=`target-new-stairs-${key}`;
    m.userData={preserveCitadelMaterials:true,preserveCitadelMaterial:true};ms.add(m);return[key,m];
  }));
  function add(name,g,material='stone',position=[0,0,0],parent=group){
    gs.add(g);const o=new THREE.Mesh(g,materials[material]);o.name=name;o.position.fromArray(position);o.castShadow=true;o.receiveShadow=true;
    o.userData.preserveCitadelMaterials=true;parent.add(o);return o;
  }
  function box(name,w,h,d,x,y,z,material='stone',parent=group,bevel=.045){
    const r=Math.min(bevel,w/5,h/5,d/5),s=new THREE.Shape();
    s.moveTo(-w/2+r,-h/2+r);s.lineTo(w/2-r,-h/2+r);s.lineTo(w/2-r,h/2-r);s.lineTo(-w/2+r,h/2-r);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,steps:1,bevelEnabled:r>0,bevelThickness:r,bevelSize:r,bevelSegments:1,curveSegments:1});g.translate(0,0,-d/2+r);
    return add(name,g,material,[x,y,z],parent);
  }
  function prism(name,poly,top,bottom,material='stone'){
    const n=poly.length,verts=[...poly.map(p=>[p[0],top,p[1]]),...poly.map(p=>[p[0],bottom,p[1]])],indices=[];
    // Input polygons are clockwise in XZ: their tops face +Y.
    for(let i=1;i<n-1;i++){indices.push(0,i,i+1,n,n+i+1,n+i);}
    for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,n+i,j,j,n+i,n+j);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(indices.flatMap(i=>verts[i]),3));g.computeVertexNormals();
    return add(name,g,material);
  }
  function sample(id,p,top,bottom=foundationBottom){
    if(!surfaceHeightAt)return null;const y=surfaceHeightAt(p[0],p[1]);
    if(y!==null&&!Number.isFinite(y))throw new Error('surfaceHeightAt returned nonfinite height');
    supportSamples.push({id,x:p[0],z:p[1],top,terrainY:y,buriedBy:y===null?null:Math.max(0,y-top),foundationGap:y===null?null:Math.max(0,bottom-y)});return y;
  }
  // Build cross-sections with shared miter joints. Stair tops remain horizontal.
  const sections=[];let cumulative=0;
  for(let i=0;i<route.length;i++){
    const p=route[i],tangents=[];
    for(const j of [i-1,i])if(j>=0&&j<route.length-1){const a=route[j],b=route[j+1],l=Math.hypot(b[0]-a[0],b[2]-a[2]);tangents.push([(b[0]-a[0])/l,(b[2]-a[2])/l]);}
    const normals=tangents.map(t=>[t[1],-t[0]]),sum=normals.reduce((a,b)=>[a[0]+b[0],a[1]+b[1]],[0,0]),len=Math.hypot(...sum);
    if(len<.1)throw new RangeError('hairpin requires a separate landing patch');
    const normal=sum.map(x=>x/len),denom=normal[0]*normals[0][0]+normal[1]*normals[0][1];
    if(denom<.6)throw new RangeError('corner too sharp for safe stair miter');
    const offset=normal.map(v=>v*(width/2)/denom);
    if(i)cumulative+=Math.hypot(p[0]-route[i-1][0],p[2]-route[i-1][2]);
    sections.push({p:[...p],left:[p[0]-offset[0],p[2]-offset[1]],right:[p[0]+offset[0],p[2]+offset[1]],s:cumulative});
  }
  const centreline=route.map(p=>[p[0],p[2]]);
  let treadOrdinal=0;
  for(let seg=0;seg<sections.length-1;seg++){
    const a=sections[seg],b=sections[seg+1],drop=a.p[1]-b.p[1],count=drop>1e-8?Math.ceil(drop/maxRise):1;
    const going=(b.s-a.s)/count;
    if(drop>0&&going<.28)throw new RangeError('insufficient run: tread going below .28m');
    for(let i=0;i<count;i++){
      const t0=i/count,t1=(i+1)/count,l0=lerp(a.left,b.left,t0),r0=lerp(a.right,b.right,t0),l1=lerp(a.left,b.left,t1),r1=lerp(a.right,b.right,t1);
      const top=a.p[1]-drop*t1,poly=[l0,l1,r1,r0],id=drop>0?`new-city-descent-tread-${treadOrdinal++}`:`new-city-descent-landing-${seg}`;
      const mesh=prism(id,poly,top,foundationBottom);mesh.userData.targetWalkable=true;
      const cp=lerp(a.p,b.p,(t0+t1)/2);cp[1]=top;
      walkSurfaces.push({id,polygon:poly,topY:top,centre:cp,rise:drop/count,going,segment:seg,from:lerp(a.p,b.p,t0),to:lerp(a.p,b.p,t1)});
      footprints.push({id,polygon:poly,floorY:foundationBottom,roofY:top,walkable:true});
      for(const p of [...poly,[cp[0],cp[2]]])sample(id,p,top);
      // Fine coping beside the walkable slab; never across the stair centre.
      for(const [side,q0,q1]of[['left',l0,l1],['right',r0,r1]]){
        const dx=q1[0]-q0[0],dz=q1[1]-q0[1],length=Math.hypot(dx,dz),ox=side==='left'?-dz/length*.22:dz/length*.22,oz=side==='left'?dx/length*.22:-dx/length*.22;
        const centre=[(q0[0]+q1[0])/2+ox,(q0[1]+q1[1])/2+oz];
        const wall=box(`${id}-${side}-parapet`,.28,.82,length+.025,centre[0],top+.41,centre[1],'stone');wall.rotation.y=Math.atan2(dx,dz);
        const cap=box(`${id}-${side}-coping`,.39,.13,length+.03,centre[0],top+.86,centre[1],'trim');cap.rotation.y=wall.rotation.y;
      }
    }
  }
  // A flat terminal landing feeds the plaza. No statue or horse is relocated.
  const end=sections.at(-1),prev=sections.at(-2),dx=end.p[0]-prev.p[0],dz=end.p[2]-prev.p[2],len=Math.hypot(dx,dz),forward=[dx/len,dz/len];
  const terminalDepth=2.4,l2=[end.left[0]+forward[0]*terminalDepth,end.left[1]+forward[1]*terminalDepth],r2=[end.right[0]+forward[0]*terminalDepth,end.right[1]+forward[1]*terminalDepth];
  const terminal=[end.left,l2,r2,end.right];
  prism('new-city-plaza-arrival',terminal,end.p[1],foundationBottom,'paving').userData.targetWalkable=true;
  const terminalCentre=[end.p[0]+forward[0]*terminalDepth/2,end.p[1],end.p[2]+forward[1]*terminalDepth/2];
  walkSurfaces.push({id:'new-city-plaza-arrival',polygon:terminal,topY:end.p[1],centre:terminalCentre,rise:0,going:terminalDepth,segment:sections.length-1});
  footprints.push({id:'new-city-plaza-arrival',polygon:terminal,floorY:foundationBottom,roofY:end.p[1],walkable:true});
  for(const p of terminal)sample('new-city-plaza-arrival',p,end.p[1]);
  const exit=[end.p[0]+forward[0]*terminalDepth,end.p[1],end.p[2]+forward[1]*terminalDepth];
  function atDistance(s){
    let i=0;while(i<sections.length-2&&sections[i+1].s<s)i++;
    const a=sections[i],b=sections[i+1],t=THREE.MathUtils.clamp((s-a.s)/(b.s-a.s),0,1),p=lerp(a.p,b.p,t),l=Math.hypot(b.p[0]-a.p[0],b.p[2]-a.p[2]);
    return{p,tangent:[(b.p[0]-a.p[0])/l,(b.p[2]-a.p[2])/l]};
  }
  function roof(parent,name,w,d,h,y){
    const v=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[-w*.22,h,0],[w*.22,h,0]],idx=[0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0,0,1,2,0,2,3];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(idx.flatMap(i=>v[i]),3));g.computeVertexNormals();add(`${name}-hip-roof`,g,'roof',[0,y,0],parent);
    box(`${name}-orange-eave`,w,.17,d,0,y,0,'roofLight',parent);box(`${name}-ridge`,w*.45,.12,.19,0,y+h,0,'roofLight',parent);
  }
  function window(parent,name,x,y,z,yaw=0){
    const g=new THREE.Group();g.name=name;g.position.set(x,y,z);g.rotation.y=yaw;parent.add(g);
    box(`${name}-white-frame`,.68,.72,.10,0,0,0,'window',g,.025);
    box(`${name}-dark-inset`,.46,.48,.035,0,0,.06,'glass',g,.01);
    box(`${name}-mullion`,.045,.5,.035,0,0,.085,'window',g,.01);
    box(`${name}-sill`,.76,.10,.18,0,-.36,.03,'window',g,.025);
  }
  const houseFoundations=[];
  // Retain the original outer envelope. Arcades have real inset volume and a
  // structural back wall; they are not claimed as public through passages.
  function houseFoundation(root,id,w,d,base,bottom,wallMaterial,centre){
    const fw=w+.32,fd=d+.32,height=base-bottom;
    if(height<1.7){box(`${id}-foundation`,fw,height,fd,0,-height/2,0,'trim',root);houseFoundations.push({id,height,mode:'low-plinth',arcades:[],publicThroughPassage:false});return;}
    const depth=.58,coreW=fw-2*depth,coreD=fd-2*depth;
    box(`${id}-foundation-core`,coreW,height,coreD,0,-height/2,0,'stone',root,.02);
    const levels=Math.min(8,Math.ceil(height/3.2)),levelHeight=height/levels,arcades=[],facades=[];
    const faces=[{name:'front',span:fw,x:0,z:fd/2,yaw:0},{name:'back',span:fw,x:0,z:-fd/2,yaw:Math.PI},{name:'right',span:fd,x:fw/2,z:0,yaw:Math.PI/2},{name:'left',span:fd,x:-fw/2,z:0,yaw:-Math.PI/2}];
    for(const face of faces){
      const fg=new THREE.Group();fg.name=`${id}-foundation-${face.name}`;fg.position.set(face.x,0,face.z);fg.rotation.y=face.yaw;root.add(fg);
      const half=face.span/2,openingWidth=Math.min(1.95,face.span*.43),r=openingWidth/2,cs=Math.cos(face.yaw),sn=Math.sin(face.yaw);
      // Along the opening and two jambs, plus facade corners: report uncertain
      // samples rather than inventing clearance behind a mountain face.
      const probes=[-half,-r-.15,-r,0,r,r+.15,half].map(u=>{const x=centre[0]+face.x+cs*u,z=centre[1]+face.z-sn*u,y=surfaceHeightAt?surfaceHeightAt(x,z):null;if(y!==null&&!Number.isFinite(y))throw new Error('nonfinite facade terrain sample');return{x,z,y};});
      const archProbes=probes.slice(1,6),known=archProbes.every(p=>p.y!==null),ground=known?Math.max(...archProbes.map(p=>p.y))-base:null;
      facades.push({side:face.name,groundSamples:probes,allSampled:known});
      for(let level=0;level<levels;level++){
        const top=-level*levelHeight,low=-(level+1)*levelHeight,colour=level<2?wallMaterial:'stone',floor=known?Math.max(low+.15,ground+.12):low+.15,crown=top-.25,spring=crown-r;
        const open=known&&spring-floor>=.85&&crown-floor>=1.6;
        const shape=new THREE.Shape();shape.moveTo(-half,low);shape.lineTo(half,low);shape.lineTo(half,top);shape.lineTo(-half,top);shape.closePath();
        if(open){
          const hole=new THREE.Path();hole.moveTo(-r,floor);hole.lineTo(-r,spring);hole.absarc(0,spring,r,Math.PI,0,true);hole.lineTo(r,floor);hole.closePath();shape.holes.push(hole);
        }
        const g=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:false,curveSegments:12});g.translate(0,0,-depth);
        add(`${id}-${face.name}-lower-wall-${level}`,g,colour,[0,0,0],fg);
        // Narrow belt remains at the original facade plane, never in the route.
        box(`${id}-${face.name}-level-belt-${level}`,face.span,.10,.10,0,top-.05,-.05,'trim',fg,.01);
        if(open){
          // Solid arch ring around the real cutout. Its back is not a black quad.
          const outer=r+.15,ring=new THREE.Shape();ring.moveTo(-outer,floor);ring.lineTo(-outer,spring);ring.absarc(0,spring,outer,Math.PI,0,true);ring.lineTo(outer,floor);ring.lineTo(r,floor);ring.lineTo(r,spring);ring.absarc(0,spring,r,0,Math.PI,false);ring.lineTo(-r,floor);ring.closePath();
          const rg=new THREE.ExtrudeGeometry(ring,{depth:.065,steps:1,bevelEnabled:false,curveSegments:12});rg.translate(0,0,-.065);add(`${id}-${face.name}-arch-ring-${level}`,rg,'trim',[0,0,0],fg);
          box(`${id}-${face.name}-arch-threshold-${level}`,openingWidth,.09,depth,0,floor-.045,-depth/2,'trim',fg,.012);
          arcades.push({side:face.name,level,width:openingWidth,floorY:base+floor,springY:base+spring,crownY:base+crown,wallDepth:depth,backWallRetained:true,throughPassage:false,minimumGroundClearance:base+floor-Math.max(...archProbes.map(p=>p.y)),jambWidth:(face.span-openingWidth)/2,centreLocal:[centre[0]+face.x,base+floor+(crown-floor)*.38,centre[1]+face.z],outwardLocal:[sn,0,cs]});
        }
      }
    }
    // Floor plates connect all four facade shells to the retained core.
    for(let i=0;i<=levels;i++){const y=-i*levelHeight;box(`${id}-foundation-floor-${i}`,fw,.12,fd,0,Math.max(-height+.06,y-.06),0,'stone',root,.015);}
    box(`${id}-foundation-cornice`,w+.44,.14,d+.44,0,-.07,0,'roofLight',root,.025);
    // Static foundation detail is baked by material per house, retaining real
    // arch holes while avoiding dozens of tiny draw calls per storey.
    root.updateWorldMatrix(true,true);const inv=root.matrixWorld.clone().invert(),batches=new Map(),parts=[];
    root.traverse(m=>{if(m.isMesh){parts.push(m);if(!batches.has(m.material))batches.set(m.material,{position:[],normal:[]});const out=batches.get(m.material),g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,m.matrixWorld));out.position.push(...g.attributes.position.array);out.normal.push(...g.attributes.normal.array);g.dispose();}});
    for(const m of parts){m.removeFromParent();gs.delete(m.geometry);m.geometry.dispose();}
    for(const child of [...root.children])if(child.isGroup&&child.children.length===0)root.remove(child);
    for(const [material,b]of batches){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.position,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.normal,3));const key=Object.keys(materials).find(k=>materials[k]===material);add(`${id}-foundation-batched-${key}`,g,key,[0,0,0],root);}
    houseFoundations.push({id,height,mode:'sampled-tiered-recessed-arcade',levels,wallDepth:depth,coreSize:[coreW,height,coreD],facades,arcades,draws:batches.size,publicThroughPassage:false,footprintExpanded:false,requiresGpuReview:true});
  }
  const rejectedHouses=[],houseLayoutAdjustments=[];
  if(includeHouses)for(const [row,fraction]of[.18,.48,.8].entries())for(const side of[-1,1]){
    const station=atDistance(cumulative*fraction),w=4.35+(row%2)*.45,d=4.4,h=(housingProfile==='original'?[6.6,5.5,4.8][row]+(side===1?.5:0):[5.6,4.5,3.6][row]+(side===1?.25:0)),n=[station.tangent[1],-station.tangent[0]];
    let centre=null,poly=null;
    // Authored offsets stay outside all segments, not only the closest station.
    for(let offset=width/2+Math.hypot(w,d)/2+.9;offset<=12;offset+=.6){
      const p=[station.p[0]+side*n[0]*offset,station.p[2]+side*n[1]*offset];
      const fw=w+.5,fd=d+.5,q=[[-fw/2,-fd/2],[fw/2,-fd/2],[fw/2,fd/2],[-fw/2,fd/2]].map(([x,z])=>[p[0]+x,p[1]+z]);
      if(q.every(v=>centreline.slice(1).every((b,i)=>pointSegmentDistance(v,centreline[i],b)>width/2+.35))){centre=p;poly=q;break;}
    }
    const id=`new-city-stair-house-${row}-${side}`;
    if(!centre){rejectedHouses.push({id,reason:'no-safe-offset-from-stair'});continue;}
    // The inside of the first bend brings the second right-hand plot back
    // toward the first. Separate their complete roof envelopes by 0.4 m,
    // moving only this upper plot toward the main building, before sampling.
    // Round outward to 0.1 m so floating-point noise cannot close the gap.
    if(row===1&&side===1){
      const previous=footprints.find(p=>p.id==='new-city-stair-house-0-1');
      if(previous){const a=previous.polygon,b=poly,min=k=>Math.min(...a.map(p=>p[k])),max=k=>Math.max(...a.map(p=>p[k]));
        if(Math.max(...b.map(p=>p[0]))>min(0)&&Math.min(...b.map(p=>p[0]))<max(0)&&Math.max(...b.map(p=>p[1]))>min(1)-.4&&Math.min(...b.map(p=>p[1]))<max(1)){
          const dz=-Math.ceil((Math.max(...b.map(p=>p[1]))-min(1)+.4)*10)/10;
          centre=[centre[0],centre[1]+dz];poly=poly.map(p=>[p[0],p[1]+dz]);houseLayoutAdjustments.push({id,offset:[0,dz],reason:'separate-first-bend-roof-envelopes',against:previous.id,minimumGap:.4});
        }
      }
    }
    // Clear the FULL surveyed x=48 stair width and its outer parapet, not only
    // the walking centreline: r32's lower left house clipped the outer tread
    // at castle z=61. Keep its facade orientation and shift castle +X 1.3 m.
    if(row===2&&side===-1){const delta=[1.3*Math.cos(yaw),1.3*Math.sin(yaw)];centre=centre.map((v,i)=>v+delta[i]);poly=poly.map(p=>p.map((v,i)=>v+delta[i]));houseLayoutAdjustments.push({id,offset:delta,reason:'clear-full-surveyed-tread-and-parapet',against:'surveyed-x48-descent',minimumGap:.4});}
    // Its uphill neighbour also shared a plinth corner with the bridge pier
    // cap and stair parapet. Move castle +X / -Z 1 m each, preserving the whole support.
    if(row===0&&side===-1){const delta=[Math.cos(yaw)+Math.sin(yaw),Math.sin(yaw)-Math.cos(yaw)];centre=centre.map((v,i)=>v+delta[i]);poly=poly.map(p=>p.map((v,i)=>v+delta[i]));houseLayoutAdjustments.push({id,offset:delta,reason:'separate-plinth-from-bridge-pier-and-parapet',against:'bay-bridge-pier-3'});}
    // Explicit candidate relocation, evaluated before ALL terrain probes and
    // geometry creation. The caller audits its replacement route; this offset
    // is not a claim that the legacy authored stairs remain clear.
    const offset=houseOffsets[id];if(offset){centre=centre.map((v,i)=>v+offset[i]);poly=poly.map(p=>p.map((v,i)=>v+offset[i]));}
    let base=station.p[1],houseBottom=base-.65;
    if(surfaceHeightAt){const ys=poly.map(p=>surfaceHeightAt(...p));if(ys.some(v=>v!==null&&!Number.isFinite(v)))throw new Error('nonfinite house support');const hits=ys.filter(v=>v!==null);if(hits.length){base=Math.max(base,...hits)+.08;houseBottom=Math.min(base-.65,...hits.map(h=>h-.12));}}
    const root=new THREE.Group();root.name=id;root.position.set(centre[0],base,centre[1]);root.userData.preserveCitadelMaterials=true;group.add(root);
    const houseColour=row===1&&side===-1?'rose':(row+side)%2?'blue':'stone';
    houseFoundation(root,id,w,d,base,houseBottom,houseColour,centre);
    if(housingProfile==='original'){
      box(`${id}-walls`,w,h,d,0,h/2,0,houseColour,root,.12);
      box(`${id}-upper-cornice`,w+.16,.14,d+.16,0,h-.10,0,'trim',root,.025);
      roof(root,id,w+.5,d+.5,.95,h);
      for(const y of [2,h-1.4])for(const x of [-w*.24,w*.24])window(root,`${id}-front-${x}-${y}`,x,y,d/2+.055);
      window(root,`${id}-side`,side*w/2+.035*side,h-1.5,0,side*Math.PI/2);
    }else{
      const lower=row===2?h:2.9;
      box(`${id}-walls`,w,lower,d,0,lower/2,0,houseColour,root,.12);
      for(const x of[-w*.24,w*.24])window(root,`${id}-front-${x}`,x,1.9,d/2+.055);
      window(root,`${id}-side`,side*w/2+.035*side,1.9,0,side*Math.PI/2);
      if(row<2){
        // Full-width lower street room, recessed upper volume and a real
        // front roof terrace. All remain inside the previous roof envelope.
        const upper=new THREE.Group();upper.name=`${id}-setback-storey`;upper.position.set(-side*.13,lower,-.38);root.add(upper);
        const uw=w-.76,ud=d-1.02,uh=h-lower;
        box(`${id}-upper-walls`,uw,uh,ud,0,uh/2,0,houseColour,upper,.10);
        roof(upper,id,uw+.4,ud+.4,.82,uh);
        for(const x of[-uw*.24,uw*.24])window(upper,`${id}-upper-front-${x}`,x,uh*.52,ud/2+.055);
        box(`${id}-terrace-slab`,w+.16,.16,d+.16,0,lower+.01,0,'trim',root,.025);
        box(`${id}-terrace-low-parapet`,w+.12,.38,.15,0,lower+.24,d/2,'stone',root,.025);
        box(`${id}-terrace-orange-cap`,w+.18,.10,.19,0,lower+.46,d/2,'roofLight',root,.02);
      }else roof(root,id,w+.5,d+.5,.82,h);
    }
    // Recessed door surround is decorative; houses are not route portals.
    box(`${id}-door-trim`,1.12,2,.14,0,1,d/2+.055,'trim',root);
    box(`${id}-door-leaf`,.84,1.78,.035,0,.9,d/2+.145,'glass',root);
    if(row===0&&housingProfile==='original'){add(`${id}-cream-turret`,new THREE.CylinderGeometry(.9,1,2.7,12),'stone',[w*.23,h+1.1,-d*.18],root);add(`${id}-orange-cupola`,new THREE.SphereGeometry(1.05,16,8,0,Math.PI*2,0,Math.PI/2),'roof',[w*.23,h+2.45,-d*.18],root);}
    for(const p of poly)sample(id,p,base,houseBottom);
    footprints.push({id,polygon:poly,floorY:houseBottom,roofY:base+h+(row===0&&housingProfile==='original'?3.5:1.05),role:'stair-flank-house'});
    houses.push({id,position:[centre[0],base,centre[1]],size:[w,h,d],row,side,entrance:[centre[0],base,centre[1]+d/2],publicInterior:false,massing:housingProfile,upperSetback: housingProfile==='stepped-flanks-v5'&&row<2?[.76,1.02]:null});
  }
  // Small warm lantern caps mark landings; no extra scene lights or moving props.
  for(const i of[1,3,5])if(sections[i])for(const side of[-1,1]){
    const p=sections[i].p,edge=side<0?sections[i].left:sections[i].right,out=Math.hypot(edge[0]-p[0],edge[1]-p[2]),q=[edge[0]+(edge[0]-p[0])*.32/out,edge[1]+(edge[1]-p[2])*.32/out];
    box(`stair-landing-pier-${i}-${side}`,.52,1.25,.52,q[0],p[1]+.625,q[1],'trim');
    add(`stair-landing-lantern-${i}-${side}`,new THREE.SphereGeometry(.14,8,6),'gold',[q[0],p[1]+1.37,q[1]]);
  }
  group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(group);let meshes=0,triangles=0;
  group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  const buried=supportSamples.filter(s=>s.buriedBy>.03),misses=supportSamples.filter(s=>s.terrainY===null),gaps=supportSamples.filter(s=>s.foundationGap>.03);
  const report={revision:'target-new-city-stairs-5-stepped-flanks',housingProfile,seed,palette:colours,coordinateFrame:'targetNewCityMain local, castle origin [74,12,33], yaw -55 degrees',houseLayoutAdjustments,houseOffsets:Object.fromEntries(Object.entries(houseOffsets).map(([id,p])=>[id,[...p]])),
    route:route.map(p=>[...p]),width,maxRise,stepCount:treadOrdinal,footprints,walkSurfaces,houses,houseFoundations,rejectedHouses,
    endpoints:{mainApproach:[...route[0]],mainEntry:[0,1.2,6.7],plazaNorth:[...end.p],plazaExit:exit},
    connections:{upstream:'targetNewCityMain.report.stairs.bottom',downstream:'plaza north access; original statue/horse remain external',
      reservedLandmarkAccess:{from:exit,clearWidth:width,minimumHeadroom:3,landmarksMoved:false}},
    support:{sampled:!!surfaceHeightAt,samples:supportSamples,buriedCount:buried.length,missingCount:misses.length,gapCount:gaps.length,
      sampledPass:surfaceHeightAt?buried.length===0&&misses.length===0&&gaps.length===0:null,continuousProof:false},
    performance:{meshes,triangles,materials:ms.size},bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    validation:{gpuVerified:false,navigationIntegrated:false,landmarkClearanceVerified:false,terrainChanged:false},
    limitations:['Default route and foundations require final terrain/landmark triangle checks.','Geometry provides continuous treads, but no movement-controller or navigation integration.','House doors are decorative; main public passage is the central staircase.','Entry interface is fixed to the current main-hall model; custom routes need caller endpoint validation.']};
  group.userData.stairCandidateReport=report;let disposed=false;
  return{group,report,dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of gs)g.dispose();for(const m of ms)m.dispose();group.clear();}};
}
