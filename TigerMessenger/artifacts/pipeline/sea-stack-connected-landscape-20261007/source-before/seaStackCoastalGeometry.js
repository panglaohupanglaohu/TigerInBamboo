import * as THREE from 'three';
import {solveCoastalStackWfc} from './seaStackWfc.js';
import {smoothSeaStackSurface,SEA_STACK_SURFACE_REVISION} from './seaStackSurfaceSmoothing.js';

const legacyFootprints=new Map();
// Authored asymmetric ledges. These are lateral massing choices, not claims
// that the existing one-dimensional module solver is a three-dimensional WFC.
const LAND_FORMS=[
 {levels:[.26,.42,.79],core:[.22,.19,.34,.34],shoulder:[-.19,.06,.58,.48]},
 {levels:[.28,.64,.73],core:[.25,.22,.32,.33],shoulder:[-.23,.08,.59,.46]},
 {levels:[.34,.46,.83],core:[.24,.17,.36,.34],shoulder:[-.18,.04,.58,.51]},
 {levels:[.23,.59,.69],core:[.12,.24,.32,.35],shoulder:[-.24,.02,.52,.48]},
 {levels:[.31,.44,.81],core:[.27,.21,.33,.31],shoulder:[-.16,.03,.60,.47]},
 {levels:[.26,.65,.75],core:[.17,.27,.35,.31],shoulder:[-.23,.07,.56,.49]},
 {levels:[.32,.45,.82],core:[.24,.18,.31,.34],shoulder:[-.21,.03,.54,.50]},
 {levels:[.25,.61,.70],core:[.18,.22,.34,.32],shoulder:[-.20,.08,.57,.46]},
];
// Hand-authored unequal cliff cuts [normalX, normalZ, extent]. These are not
// regular radial segments: four long faces and two differently sized broken
// corners make limestone slabs rather than fluted or round pillar sections.
const CLIFF_PROFILES=[
 [[1,.10,.97],[-1,.04,.88],[.07,1,.91],[-.13,-1,.88],[.76,.68,1.08],[-.72,-.81,1.14]],
 [[1,-.13,.90],[-1,.12,.98],[.15,1,.95],[.05,-1,.83],[.62,-.81,1.05],[-.86,.55,1.16]],
 [[1,.05,.99],[-1,-.16,.84],[-.11,1,.94],[.12,-1,.96],[.87,.51,1.10],[-.54,-.86,1.02]],
 [[1,.17,.87],[-1,.03,.96],[.03,1,.85],[-.18,-1,.97],[.57,.89,1.11],[-.84,-.61,1.05]],
];

// Connected coastal volumes, not concentric rings. WFC selects the vertical
// coastal vocabulary; the authored lateral volumes and tetrahedral iso-surface
// extraction are a separate modeling stage, not a claim of 3D WFC.
export function coastalStackGeometry(radius,height,seed,options={}){
 const started=performance.now();
 const params=new URLSearchParams(globalThis.location?.search||'');
 const enabled=params.get('seaStackWfc')!=='0',studyEnabled=options.study??(params.get('seaStackStudy')!=='0');
 const cacheKey=[radius,height,seed,enabled].join(':');
 if(studyEnabled&&!legacyFootprints.has(cacheKey)){
  const legacy=coastalStackGeometry(radius,height,seed,{study:false});
  if(legacyFootprints.size>128)legacyFootprints.clear();
  legacyFootprints.set(cacheKey,legacy.userData.terraces.footprintRadius);legacy.dispose();
 }
 const oldEnvelope=legacyFootprints.get(cacheKey);
 const solution=solveCoastalStackWfc(enabled?(studyEnabled?(options.wfcSeed??seed):seed):0);
 // WFC chooses semantic roles consumed by the authored field. The rings in
 // the catalog are not literal mesh sections or a 3D assembly interface.
 const terraceRole=solution.modules.find(m=>m.role==='terrace').id;
 const capRole=solution.modules.find(m=>m.role==='cap').id;
 const terraceShape={
  'wide-broken-terrace':{width:1.035,depth:1.015,shiftX:-.018,shiftZ:.01},
  'narrow-broken-terrace':{width:.98,depth:.98,shiftX:.018,shiftZ:-.018},
  'recessed-terrace':{width:1,depth:.99,shiftX:-.01,shiftZ:-.035},
 }[terraceRole];
 const capShape=capRole==='blunt-broken-cap'?{style:'blunt-double-crown',saddleWidth:.19,saddleDepth:2.6,crownDrop:1.6,inset:.018}:{style:'narrow-fractured-crown',saddleWidth:.15,saddleDepth:3.25,crownDrop:2.2,inset:.045};
 const legacySolution=studyEnabled&&options.wfcSeed!==undefined?solveCoastalStackWfc(enabled?seed:0):solution;
 const phase=seed*2.399963;
 const lowerWidth=legacySolution.modules[2].top,terraceWidth=legacySolution.modules[3].top,upperWidth=legacySolution.modules[4].top;
 const variant=legacySolution.modules[3].id.includes('narrow')?'isolated-remnant':legacySolution.modules[2].id.includes('jointed')?'low-double-shoulder':'shouldered-stack';
 const shoulder=(variant==='isolated-remnant'?.20:variant==='low-double-shoulder'?.52:.36)+(1-terraceWidth)*.12+.035*Math.sin(seed*1.37),low=(variant==='low-double-shoulder'?.32:.18)+.025*Math.cos(seed*2.1);
 const angle=phase*.37,cs=Math.cos(angle),sn=Math.sin(angle);
 const shore=solution.modules[1].id==='deep-wave-notch'?.17:.10;
 const legacyShore=legacySolution.modules[1].id==='deep-wave-notch'?.17:.10;
 const crown=legacySolution.modules[5].top;
 const legacyField=(x,y,z)=>{
  const t=(y+height*.5)/height;
  const xx=(x*cs+z*sn)/radius,zz=(-x*sn+z*cs)/radius;
  const notch=legacyShore*Math.exp(-Math.pow((t-.14)/.047,2));
  // Broad bedding changes, a shallow diagonal joint and asymmetric broken sides.
  const bands=[[0,.98],[.16,.90],[.29,1.03],[.46,1.05],[.65,.91],[.79,.84],[1,.68+(upperWidth-.66)*.35]];
  let profile=bands.at(-1)[1];for(let i=1;i<bands.length;i++)if(t<=bands[i][0]){const q=THREE.MathUtils.clamp((t-bands[i-1][0])/(bands[i][0]-bands[i-1][0]),0,1);profile=bands[i-1][1]+(bands[i][1]-bands[i-1][1])*q;break;}
  profile*=.96+lowerWidth*.04;
  const joint=.035*Math.exp(-Math.pow((xx+.24-.17*t)/.055,2))*Math.max(0,t-.34);
  function slab(cx,cz,rx,rz,top){
   const u=(xx-cx)/rx,v=(zz-cz)/rz,a=Math.atan2(v,u);
   const polygon=Math.pow(Math.pow(Math.abs(u),3)+Math.pow(Math.abs(v),3),1/3);
   const broken=.035*Math.sin(a*3+phase)+.022*Math.cos(a*7-phase);
   const wall=(profile+broken-polygon-joint-notch*(.25+.75*Math.max(0,Math.cos(a-phase))))*radius;
   return Math.min(wall,(top-t)*height,t*height);
  }
  // Main remnant is offset beside a lower cliff shoulder. Its top is blunt and
  // weathered, while the shoulder and low remnant have genuine flat substrates.
  const top=(variant==='low-double-shoulder'?.79:.96)+.012*Math.sin(xx*6+phase)+.009*Math.cos(zz*8-phase)-.022*Math.max(0,xx+.1)+(crown-.55)*.05;
  const main=slab(.20,.10,.60,.53,top);
  const flank=slab(variant==='isolated-remnant'?-.25:-.33,-.06,(variant==='isolated-remnant'?.38:.50)+(1-terraceWidth)*.18,variant==='isolated-remnant'?.36:.54,shoulder);
  const toe=slab(.10,variant==='isolated-remnant'?-.22:-.38,variant==='isolated-remnant'?.36:.51,variant==='isolated-remnant'?.32:.43,low);
  return Math.max(main,flank,toe);
 };
 const form=LAND_FORMS[((seed%LAND_FORMS.length)+LAND_FORMS.length)%LAND_FORMS.length];
 const studyLevels=form.levels;
 const formIndex=((seed%8)+8)%8,terraceCount=formIndex%2===0?2:3;
 const CORE_WIDTHS=[[.55,.48],[.50,.46],[.59,.52],[.51,.45],[.56,.50],[.52,.47],[.57,.49],[.49,.46]];
 const studyField=(x,y,z)=>{
  const t=(y+height*.5)/height;
  // Keep all samples surrounding the original support plane unchanged.
  if(t<.05)return Math.min(legacyField(x,y,z),oldEnvelope-Math.hypot(x,z));
  const xx=(x*cs+z*sn)/radius,zz=(-x*sn+z*cs)/radius;
  const aboveBase=y+height*.5;
  const notch=(.19+(shore-.10)*.45)*Math.exp(-Math.pow((aboveBase-6)/1.65,2));
  function block(cx,cz,rx,rz,top,flank=0){
   const u=(xx-cx)/rx,v=(zz-cz)/rz;
   const cuts=CLIFF_PROFILES[(formIndex+Math.ceil(flank))%4];
   let wall=Infinity;
   for(let face=0;face<cuts.length;face++){
    const [nx,nz,extent]=cuts[face];
    // Each entire plane advances/recedes as one broad bedding face. No
    // angular sine bends the cross-section back into a rounded cylinder.
    const bedding=.062*Math.sin(t*4.1+seed*.63+face*.71)+.035*Math.cos(t*7.3+face*1.17+seed*.29);
    const exposed=.12+.88*Math.max(0,-nz/Math.hypot(nx,nz));
    const capInset=flank?0:capShape.inset*THREE.MathUtils.smoothstep(t,.82,.97);
    wall=Math.min(wall,(extent+bedding-capInset-(nx*u+nz*v)-notch*exposed)*radius/Math.hypot(nx,nz));
   }
   // A large oblique corner plane replaces a neat rectangular shelf end.
   const cut=flank?(1.02-.08*Math.sin(seed+flank)-(.72*u+.64*v)*Math.sign(flank))*radius:radius*4;
   const end=flank?.095*THREE.MathUtils.smoothstep((u*.55+v*.8)*Math.sign(flank),.35,.90):0;
   return Math.min(wall,cut,(top-end-t)*height,t*height);
  }
  const [cx,cz]=form.core;
  const [rx,rz]=CORE_WIDTHS[formIndex];
  // Four distinct summit compositions: high crown, lower secondary crown,
  // and a broad, non-through saddle. Drop is measured in scene metres, not a
  // repeating fraction of every pillar's height.
  const composition=((seed%4)+4)%4,fractureAngle=[-.65,.55,1.65,2.6][composition];
  const along=(xx-cx)*Math.cos(fractureAngle)+(zz-cz)*Math.sin(fractureAngle);
  const saddleAxis=along-(composition%2?.025:-.025);
  const saddle=Math.max(0,1-Math.abs(saddleAxis)/capShape.saddleWidth)*(capShape.saddleDepth+.35*(seed%3));
  const lowerCrown=(capShape.crownDrop+.30*(seed%3))*THREE.MathUtils.smoothstep(along,-.07,.14);
  const top=.965-(saddle+lowerCrown)/height+.008*Math.sin(xx*5+phase)-.016*(zz-cz);
  const main=block(cx,cz,rx,rz,top);
  // Three ledges extend on different parts of the exposed flank. None wraps
  // the main core: its rear and right silhouettes continue up to the summit.
  const upper=terraceCount===3?block(cx-.43+terraceShape.shiftX,cz-.07+terraceShape.shiftZ,.40*terraceShape.width,.36*terraceShape.depth,studyLevels[2],1):-1e6;
  const [sx,sz,srx,srz]=form.shoulder;
  const middleZ=Math.min(sz-.09,cz+rz-srz-.07)+terraceShape.shiftZ;
  // Two unequal remnants remain joined below their saddle and to the core.
  // The upper half keeps a real substrate at the authored middle level.
  const shoulderAxis=zz-middleZ-.10+.20*(xx-sx),shoulderSaddle=Math.max(0,1-Math.abs(shoulderAxis+.025)/.12)*1.8;
  const shoulderDrop=2.1*THREE.MathUtils.smoothstep(shoulderAxis,-.13,.035);
  const middle=block(sx-.035+terraceShape.shiftX,middleZ,srx*terraceShape.width,srz*terraceShape.depth,studyLevels[1]-(shoulderDrop+shoulderSaddle)/height,1.5);
  const lower=block(cx+.05,cz-.54,.53,.56,studyLevels[0],1);
  // Only the submerged plinth retains the full old profile. All new ledges
  // stay in the original conservative circle used by the unchanged layout.
  const plinth=Math.min(legacyField(x,y,z),(.095-t)*height);
  let solid=Math.max(main,upper,middle,lower,plinth);
  // An open-sided joint chips an existing exterior corner, not a bounded
  // cavity in the face. The large limestone walls remain continuous.
  const jointCenter=.66+.035*Math.sin(seed),joint=Math.max(0,1-Math.abs((t-jointCenter)/.16));
  if(joint>0){
   const u=(xx-cx)/rx,v=(zz-cz)/rz;
   const corner=(u+.72*v-(1.38-.25*joint))*radius;
   solid=Math.min(solid,-Math.min(corner,joint*radius*.17));
  }
  // Large broken bedding faces, not little drilled hollows. Each cut opens
  // through an exterior corner, spans 18-26% of the height and then ends.
  // Different normals and oblique ends break the long vertical silhouette.
  const u=(xx-cx)/rx,v=(zz-cz)/rz;
  const chips=[
   [u+.16*v,v+.10,t-.035*v,.30+.025*Math.sin(seed),.13,.22],
   [-v-.27*u,.12-u,t+.045*u,.57+.025*Math.cos(seed),.105,.25],
   [.88*v+.40*u,u-.015,t-.028*u,.80-.025*Math.sin(seed*.8),.09,.20],
  ];
  for(const [plane,opening,elevation,center,span,depth]of chips){
   const strength=Math.max(0,1-Math.abs((elevation-center)/span));
   if(strength>0){
    const cut=Math.min((plane-(.99-depth*strength))*Math.min(rx,rz)*radius,opening*radius,strength*radius*.14);
    solid=Math.min(solid,-cut);
   }
  }
  // These fractures belong to the main remnant. Its attached, lower shelves
  // remain independent rock masses instead of being erased by an infinite
  // cutting plane extending beyond the core's face.
  solid=Math.max(solid,upper,middle,lower,plinth);
  const recess=THREE.MathUtils.smoothstep(t,.36,.41)*(1-THREE.MathUtils.smoothstep(t,.49,.55));
  if(recess>0){const slot=Math.min((.075-Math.abs(xx+.13))*radius,(zz+.50)*-radius,recess*radius*.09);solid=Math.min(solid,-slot);}
  return Math.min(solid,oldEnvelope-Math.hypot(x,z));
 };
 const field=studyEnabled?studyField:legacyField;
 const nx=studyEnabled?26:18,ny=studyEnabled?44:32,nz=studyEnabled?26:18;
 const min=[-radius*1.20,-height*.52,-radius*1.20],max=[radius*1.20,height*.53,radius*1.20];
 const points=[],values=[];
 const gi=(x,y,z)=>x+(nx+1)*(y+(ny+1)*z);
 for(let z=0;z<=nz;z++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
  const p=[min[0]+(max[0]-min[0])*x/nx,min[1]+(max[1]-min[1])*y/ny,min[2]+(max[2]-min[2])*z/nz];points.push(p);values.push(field(...p));
 }
 const tet=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 const edgePairs=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
 const vertices=[],indices=[],cache=new Map();
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
 function intersection(a,b){
  if(a>b)[a,b]=[b,a];const key=a+':'+b;if(cache.has(key))return cache.get(key);
  const u=values[a]/(values[a]-values[b]),p=points[a].map((v,i)=>v+(points[b][i]-v)*u);
  if(Math.abs(p[1]+height*.5)<1e-5)p[1]=-height*.5;
  const id=vertices.length;vertices.push(p);cache.set(key,id);return id;
 }
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const cube=[gi(x,y,z),gi(x+1,y,z),gi(x+1,y+1,z),gi(x,y+1,z),gi(x,y,z+1),gi(x+1,y,z+1),gi(x+1,y+1,z+1),gi(x,y+1,z+1)];
  const positives=cube.reduce((s,i)=>s+(values[i]>=0),0);if(!positives||positives===8)continue;
  for(const ids of tet){
   const ids4=ids.map(i=>cube[i]),poly=[];
   for(const [a,b] of edgePairs)if((values[ids4[a]]>=0)!==(values[ids4[b]]>=0))poly.push(intersection(ids4[a],ids4[b]));
   if(poly.length<3)continue;
   const center=[0,0,0];for(const i of poly)vertices[i].forEach((v,j)=>center[j]+=v/poly.length);
   // Use the tetrahedron's planar cut, not a nonlinear field gradient at
   // a min/max seam: the latter can reverse triangles or misorder a quad.
   const positive=[0,0,0],negative=[0,0,0];let np=0,nn=0;
   for(const id of ids4){const dest=values[id]>=0?positive:negative;points[id].forEach((v,j)=>dest[j]+=v);if(values[id]>=0)np++;else nn++;}
   const outward=negative.map((v,j)=>v/nn-positive[j]/np);
   let gradient=norm(cross(sub(vertices[poly[1]],vertices[poly[0]]),sub(vertices[poly[2]],vertices[poly[0]])));
   if(dot(gradient,outward)<0)gradient=gradient.map(v=>-v);
   const u=norm(sub(vertices[poly[0]],center)),v=norm(cross(gradient,u));
   poly.sort((a,b)=>Math.atan2(dot(sub(vertices[a],center),v),dot(sub(vertices[a],center),u))-Math.atan2(dot(sub(vertices[b],center),v),dot(sub(vertices[b],center),u)));
   for(let i=1;i<poly.length-1;i++){
    let b=poly[i],c=poly[i+1];const normal=cross(sub(vertices[b],vertices[poly[0]]),sub(vertices[c],vertices[poly[0]]));
    if(dot(normal,gradient)<0)[b,c]=[c,b];indices.push(poly[0],b,c);
   }
  }
 }
 // Exact iso values at a lattice corner can be reached through several grid
 // edges. Weld those positions before discarding collapsed triangles.
 const welded=[],lookup=new Map(),remap=vertices.map(p=>{
  const q=p.map(v=>Math.round(v*1e5)/1e5),key=q.join(',');
  if(!lookup.has(key)){lookup.set(key,welded.length);welded.push(q);}return lookup.get(key);
 });
 const faces=[];for(let i=0;i<indices.length;i+=3){const a=remap[indices[i]],b=remap[indices[i+1]],c=remap[indices[i+2]];if(a!==b&&b!==c&&a!==c)faces.push(a,b,c);}
 // Keep the pre-finish bound authoritative: layout and clearance placement
 // must not shift when the visual finish is enabled or disabled.
 const conservativeFootprint=studyEnabled?oldEnvelope:Math.max(...welded.map(p=>Math.hypot(Math.fround(p[0]),Math.fround(p[2]))));
 const levels=studyEnabled?studyLevels.slice(0,terraceCount):[low,shoulder];
 const finish=smoothSeaStackSurface(welded,faces,{radius,height,terraceLevels:levels,enabled:studyEnabled&&params.get('seaStackSmooth')!=='0'});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(finish.positions.flat(),3));g.setIndex(faces);g.computeVertexNormals();
 // Area-weighted normals suppress tetrahedron diagonals. Flat ledges remain
 // planar in geometry; their interior vertices keep exact upward normals.
 const p=g.attributes.position,n=g.attributes.normal,colors=[],color=new THREE.Color();
 const sun=new THREE.Vector3(-.65,.7,.3).normalize(),normal=new THREE.Vector3(),dark=new THREE.Color(0x526c80),light=new THREE.Color(0xacbcc0),shelf=new THREE.Color(0x9eaead),wet=new THREE.Color(0x344f60);
 let footprintRadius=0;
 for(let i=0;i<p.count;i++){
  normal.fromBufferAttribute(n,i);const shade=.18+.82*Math.max(0,normal.dot(sun));color.copy(dark).lerp(light,shade);
  if(normal.y>.88)color.lerp(shelf,.5);
  const t=(p.getY(i)+height*.5)/height;if(t<.19)color.lerp(wet,.40*(1-t/.19));
  colors.push(color.r,color.g,color.b);footprintRadius=Math.max(footprintRadius,Math.hypot(p.getX(i),p.getZ(i)));
 }
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingBox();g.computeBoundingSphere();
 if(enabled)g.userData.wfc={...solution,modules:solution.modules.map(m=>m.id),scope:'1D module vocabulary; authored connected coastal volumes + marching tetrahedra surface'};
 if(studyEnabled)g.userData.semanticWfc={scope:'WFC role IDs drive bounded semantic shape parameters; no literal ring assembly',modelSeed:seed,wfcSeed:solution.seed,terraceRole,capRole,terraceShape:{...terraceShape},capShape:{...capShape}};
 if(studyEnabled)g.userData.landform={revision:11,terraceCount,composition:formIndex%4,coreWidths:CORE_WIDTHS[formIndex],core:'six unequal hand-authored cliff planes; four profile compositions',terraces:'two or three role-specific substrates with oblique fading ends',summit:'four azimuth compositions; high crown, low crown and 2-5m saddle',erosion:'three nonparallel broken bedding cuts and open corner joint; sea erosion centered 6m above fixed bottom',coordinates:'unchanged local placement; old support-plane height and conservative footprint'};
 g.userData.surfaceSmoothing={revision:SEA_STACK_SURFACE_REVISION,features:{base:'locked',terraces:'height-preserved',creases:'edge-chain-only',junctions:'locked'},smoothStats:finish.stats};
 g.userData.terraces={revision:studyEnabled?11:4,seed,variant:studyEnabled?'fractured-coastal-shoulders-'+(seed%8):variant,levels,mode:studyEnabled?'continuous-core-with-local-flank-ledges':'connected-coastal-volumes',footprintRadius:conservativeFootprint,surfaceFootprintRadius:footprintRadius,smoothStats:finish.stats,modules:solution.modules.map(m=>m.id),socketMismatches:solution.socketMismatches,grid:[nx,ny,nz],triangles:faces.length/3,constructionMs:performance.now()-started};
 return g;
}
