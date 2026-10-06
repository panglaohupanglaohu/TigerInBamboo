import * as THREE from 'three';
import { TARGET_NEW_CITY_MAIN_PALETTE } from './targetNewCityMain.js';

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
  width=6.2,maxRise=.25,foundationBottom=-10.2,surfaceHeightAt=null,includeHouses=true}={}) {
  if(!Array.isArray(route)||route.length<2||!route.every(triple))throw new TypeError('route must contain finite local triples');
  if(!Number.isFinite(width)||width<4||width>10||!Number.isFinite(maxRise)||maxRise<=0||maxRise>.3)throw new RangeError('invalid stair width/rise');
  if(!Number.isFinite(foundationBottom)||foundationBottom>=Math.min(...route.map(p=>p[1]))-.05)throw new RangeError('foundation must be below route');
  if(surfaceHeightAt!==null&&typeof surfaceHeightAt!=='function')throw new TypeError('surfaceHeightAt must be a function');
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
    box(`${name}-white-frame`,.68,.96,.10,0,0,0,'window',g,.025);
    box(`${name}-dark-inset`,.46,.71,.035,0,0,.06,'glass',g,.01);
    box(`${name}-mullion`,.055,.73,.035,0,0,.085,'window',g,.01);
    box(`${name}-sill`,.83,.12,.22,0,-.48,.03,'window',g,.025);
  }
  const rejectedHouses=[];
  if(includeHouses)for(const [row,fraction]of[.18,.48,.8].entries())for(const side of[-1,1]){
    const station=atDistance(cumulative*fraction),w=4.35+(row%2)*.45,d=4.4,h=[6.6,5.5,4.8][row]+(side===1?.5:0),n=[station.tangent[1],-station.tangent[0]];
    let centre=null,poly=null;
    // Authored offsets stay outside all segments, not only the closest station.
    for(let offset=width/2+Math.hypot(w,d)/2+.9;offset<=12;offset+=.6){
      const p=[station.p[0]+side*n[0]*offset,station.p[2]+side*n[1]*offset];
      const fw=w+.5,fd=d+.5,q=[[-fw/2,-fd/2],[fw/2,-fd/2],[fw/2,fd/2],[-fw/2,fd/2]].map(([x,z])=>[p[0]+x,p[1]+z]);
      if(q.every(v=>centreline.slice(1).every((b,i)=>pointSegmentDistance(v,centreline[i],b)>width/2+.35))){centre=p;poly=q;break;}
    }
    const id=`new-city-stair-house-${row}-${side}`;
    if(!centre){rejectedHouses.push({id,reason:'no-safe-offset-from-stair'});continue;}
    let base=station.p[1],houseBottom=base-.65;
    if(surfaceHeightAt){const ys=poly.map(p=>surfaceHeightAt(...p));if(ys.some(v=>v!==null&&!Number.isFinite(v)))throw new Error('nonfinite house support');const hits=ys.filter(v=>v!==null);if(hits.length){base=Math.max(base,...hits)+.08;houseBottom=Math.min(base-.65,...hits.map(h=>h-.12));}}
    const root=new THREE.Group();root.name=id;root.position.set(centre[0],base,centre[1]);root.userData.preserveCitadelMaterials=true;group.add(root);
    box(`${id}-foundation`,w+.32,base-houseBottom,d+.32,0,(houseBottom-base)/2,0,'trim',root);
    box(`${id}-walls`,w,h,d,0,h/2,0,row===1&&side===-1?'rose':(row+side)%2?'blue':'stone',root,.12);
    roof(root,id,w+.5,d+.5,.95,h);
    for(const y of [2,h-1.4])for(const x of [-w*.24,w*.24])window(root,`${id}-front-${x}-${y}`,x,y,d/2+.055);
    window(root,`${id}-side`,side*w/2+.035*side,h-1.5,0,side*Math.PI/2);
    // Recessed door surround is decorative; houses are not route portals.
    box(`${id}-door-trim`,1.12,2,.14,0,1,d/2+.055,'trim',root);
    box(`${id}-door-leaf`,.84,1.78,.035,0,.9,d/2+.145,'glass',root);
    if(row===0){add(`${id}-cream-turret`,new THREE.CylinderGeometry(.9,1,2.7,12),'stone',[w*.23,h+1.1,-d*.18],root);add(`${id}-orange-cupola`,new THREE.SphereGeometry(1.05,16,8,0,Math.PI*2,0,Math.PI/2),'roof',[w*.23,h+2.45,-d*.18],root);}
    for(const p of poly)sample(id,p,base,houseBottom);
    footprints.push({id,polygon:poly,floorY:houseBottom,roofY:base+h+(row===0?3.5:1.05),role:'stair-flank-house'});
    houses.push({id,position:[centre[0],base,centre[1]],size:[w,h,d],row,side,entrance:[centre[0],base,centre[1]+d/2],publicInterior:false});
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
  const report={revision:'target-new-city-stairs-1',seed,coordinateFrame:'targetNewCityMain local, castle origin [74,12,33], yaw -55 degrees',
    route:route.map(p=>[...p]),width,maxRise,stepCount:treadOrdinal,footprints,walkSurfaces,houses,rejectedHouses,
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
