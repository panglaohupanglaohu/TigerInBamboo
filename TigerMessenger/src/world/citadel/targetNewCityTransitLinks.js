import * as T from 'three';
import {TARGET_ARCHITECTURE_PALETTE} from './targetArchitecturePalette.js';
export const TARGET_NEW_CITY_TRANSIT_LINKS_VERSION='target-new-city-transit-links-1';
const V=p=>new T.Vector3(...p),faces=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7];
const read=(fn,x,z)=>{const v=fn(x,z),h=typeof v==='number'?v:v?.height;return Number.isFinite(h)?h:null;};
/** Detached, opt-in two-link B candidate. World railway, castle-local surfaces.
 * The endpoint search requires actual nine-point flat floor samples in the
 * plaza height band; an ellipse or nominal platform height is never a floor.
 * Caller trims its OWN gallery rails with openings and audits the joined scene.
 */
export function createTargetNewCityTransitLinks({release,castleMatrix=release?.castleMatrix,sampleTerrain,sampleSea,stations=[55,65],stationStep=2,width=2.4,walkwayHeight=6.9,landwardTarget=[62,76],publicFloorBand=[2.6,3.1],protectedDiscs=[{id:'statue',center:[56,78],radius:4.6},{id:'horse',center:[72,78],radius:5}],vehicleEnvelope={},palette={}}={}){
 if(!release?.segments?.center?.newShore?.getPointAt||!release.curves?.red||!release.curves?.blue||typeof sampleTerrain!=='function'||typeof sampleSea!=='function')throw new TypeError('actual release and terrain/sea samplers required');
 if(![width,walkwayHeight,stationStep].every(Number.isFinite)||width<2.4||walkwayHeight<6.9||stationStep<=0||stationStep>2||!Array.isArray(stations)||stations.length!==2||new Set(stations).size!==2||!stations.every(Number.isInteger))throw new RangeError('two distinct stations, >=2.4m width and >=6.9m deck clearance required');
 const matrix=castleMatrix?.isMatrix4?castleMatrix.clone():new T.Matrix4().fromArray(castleMatrix??[]);if(matrix.elements.length!==16||!matrix.elements.every(Number.isFinite)||Math.abs(matrix.determinant())<1e-10)throw new TypeError('finite invertible castleMatrix required');const inverse=matrix.clone().invert();
 const group=new T.Group();group.name='target-new-city-transit-links';group.userData.preserveCitadelMaterials=true;
 const geoms=[],mats=[],links=[],openings=[],walkPaths=[],issues=[],trials=[],buffers={treads:[],arches:[],rails:[]};let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;group.removeFromParent();geoms.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());group.clear();};
 const prism=(p,out)=>{for(const i of faces)out.push(...p[i].toArray());};
 const box=(a,right,forward,w,h,d,out)=>{const bottom=a.clone().add(new T.Vector3(0,-h,0));prism([[-1,-1],[-1,1],[1,1],[1,-1]].map(([x,z])=>bottom.clone().addScaledVector(right,x*w/2).addScaledVector(forward,z*d/2)).concat([[-1,-1],[-1,1],[1,1],[1,-1]].map(([x,z])=>a.clone().addScaledVector(right,x*w/2).addScaledVector(forward,z*d/2))),out);};
 try{
 const curve=release.segments.center.newShore,n=Math.ceil(curve.getLength()/stationStep);
 for(const station of stations){
  if(station<0||station>n)throw new RangeError('station outside actual new-shore sampling');
  const u=station/n,p=curve.getPointAt(u),t=curve.getTangentAt(u).normalize(),radialRight=p.clone().normalize().cross(t).normalize(),up=t.clone().cross(radialRight).normalize(),center=p.clone().addScaledVector(up,walkwayHeight).applyMatrix4(inverse),r=radialRight.clone().transformDirection(inverse);
  const side=Math.sign(r.x*(landwardTarget[0]-center.x)+r.z*(landwardTarget[1]-center.z))||1;r.multiplyScalar(side);
  const forward=new T.Vector3(r.x,0,r.z).normalize(),right=new T.Vector3(forward.z,0,-forward.x),localUp=up.clone().transformDirection(inverse),plane=q=>center.y-(localUp.x*(q.x-center.x)+localUp.z*(q.z-center.z))/localUp.y;
  // Stay at the railway roof plane until outside BOTH cargo lane envelopes.
  const start=p.clone().addScaledVector(up,walkwayHeight).addScaledVector(radialRight,side*1.65).applyMatrix4(inverse),exit=p.clone().addScaledVector(up,walkwayHeight).addScaledVector(radialRight,side*7).applyMatrix4(inverse),landingLength=Math.hypot(exit.x-start.x,exit.z-start.z);
  let selected=null;const rejected=[];
  for(let dist=Math.max(14,landingLength+5);dist<=22;dist+=.5){const end=start.clone().addScaledVector(forward,dist),floor=[];
   for(const along of[-.65,0,.65])for(const lateral of[-width/2,0,width/2]){const q=end.clone().addScaledVector(forward,along).addScaledVector(right,lateral);floor.push(read(sampleTerrain,q.x,q.z));}
   const missing=floor.some(h=>h===null),lo=missing?null:Math.min(...floor),hi=missing?null:Math.max(...floor),blocked=protectedDiscs.some(d=>Math.hypot(end.x-d.center[0],end.z-d.center[1])<d.radius+width/2+.7);
   const sea=read(sampleSea,end.x,end.z);
   const grade=missing?Infinity:Math.abs(hi-exit.y)/(dist-landingLength-1.2);
   if(missing||sea===null||lo<=sea+1.5||lo<publicFloorBand[0]||hi>publicFloorBand[1]||hi-lo>.09||grade>.48||blocked){rejected.push({distance:dist,min:lo,max:hi,sea,grade,protected:blocked});continue;}
   end.y=hi+.012;selected={end,dist,floor,grade,sea};break;
  }
  trials.push({station,u,rejected});if(!selected){issues.push({type:'no-actual-public-floor-endpoint',station});continue;}
  const {end,dist}=selected,usable=dist-landingLength-1.2,count=Math.max(Math.ceil(Math.abs(end.y-exit.y)/.15),Math.floor(usable/.42)),run=usable/count,rise=(end.y-exit.y)/count,id='new-city-transit-link-'+station,surfaces=[],path=[start.toArray()],terrainRows=[],foundationRows=[];
  const levels=Array.from({length:count},(_,i)=>exit.y+rise*(i+1));
  // On ascending links, carry required rises toward the sea before any known
  // terrain penetration. Descending links are screened, never excavated.
  if(rise>0){for(let i=0;i<count;i++){const at=landingLength+i*run;let required=levels[i];for(const a of[.02,.5,.98])for(const l of[-width/2,0,width/2]){const q=start.clone().addScaledVector(forward,at+a*run).addScaledVector(right,l),h=read(sampleTerrain,q.x,q.z);if(h!==null)required=Math.max(required,h+.025);}levels[i]=Math.min(end.y,required);}for(let i=count-2;i>=0;i--)levels[i]=Math.max(levels[i],levels[i+1]-.15);}
  const topAt=d=>d<landingLength?plane(start.clone().addScaledVector(forward,d)):d>=dist-1.2?end.y:levels[Math.min(count-1,Math.max(0,Math.floor((d-landingLength)/run)))];
  // Four-centimetre real stone nosings close radial foot-ray seams at risers.
  const section=(a,b,y0,y1,kind)=>{if(kind==='tread'){a-=.04;b+=.04;}const A=start.clone().addScaledVector(forward,a).setY(y0),B=start.clone().addScaledVector(forward,b).setY(y1),corners=[A.clone().addScaledVector(right,-width/2),B.clone().addScaledVector(right,-width/2),B.clone().addScaledVector(right,width/2),A.clone().addScaledVector(right,width/2)];
   if(kind==='roof-plane')for(const q of corners)q.y=plane(q);
   prism([...corners.map(q=>q.clone().add(new T.Vector3(0,-.24,0))),...corners],buffers.treads);surfaces.push({kind,corners:corners.map(q=>q.toArray()),polygon:corners.map(q=>[q.x,q.z])});path.push(A.clone().lerp(B,.5).toArray());
  };
  section(-.12,landingLength,start.y,exit.y,'roof-plane');for(let i=0;i<count;i++)section(landingLength+i*run,landingLength+(i+1)*run,levels[i],levels[i],'tread');section(dist-1.2,dist+.65,end.y,end.y,'plaza-landing');path.push(end.toArray());
  for(let d=0;d<=dist;d+=.25)for(const lateral of[-width/2+.1,0,width/2-.1]){const q=start.clone().addScaledVector(forward,d).addScaledVector(right,lateral),h=read(sampleTerrain,q.x,q.z),top=d<landingLength?plane(q):topAt(d);terrainRows.push({point:[q.x,top,q.z],ground:h,penetration:h===null?null:h-top});}
  // Two land-side foundations carry narrow arch spandrels; no pier descends
  // from the part over either railway lane, and the arch centre stays open.
  const supportD=[landingLength+.85,dist-1.05];
  for(const d of supportD)for(const side of[-1,1]){const q=start.clone().addScaledVector(forward,d).addScaledVector(right,side*(width/2-.18)),hs=[];for(const a of[-.3,.3])for(const b of[-.3,.3]){const s=q.clone().addScaledVector(right,a).addScaledVector(forward,b);hs.push(read(sampleTerrain,s.x,s.z));}const bottom=hs.some(h=>h===null)?null:Math.min(...hs)-.08,top=topAt(d)-.22;foundationRows.push({point:q.toArray(),bottom,top});if(bottom===null){issues.push({type:'foundation-missing',station});continue;}if(top>bottom)box(q.clone().setY(top),right,forward,.6,top-bottom,.6,buffers.arches);}
  for(const side of[-1,1])for(let j=0;j<20;j++){const d0=T.MathUtils.lerp(supportD[0],supportD[1],j/20),d1=T.MathUtils.lerp(supportD[0],supportD[1],(j+1)/20),a=start.clone().addScaledVector(forward,d0).addScaledVector(right,side*(width/2-.18)),b=start.clone().addScaledVector(forward,d1).addScaledVector(right,side*(width/2-.18)),y0=topAt(d0)-.22,y1=topAt(d1)-.22,depth=q=>.3+1.7*(1-Math.sqrt(Math.max(0,1-(2*q-1)**2))),corners=[a.clone().addScaledVector(right,-.16),b.clone().addScaledVector(right,-.16),b.clone().addScaledVector(right,.16),a.clone().addScaledVector(right,.16)];prism(corners.map((q,k)=>q.clone().setY(k===0||k===3?y0-depth(j/20):y1-depth((j+1)/20))).concat(corners.map((q,k)=>q.clone().setY(k===0||k===3?y0:y1))),buffers.arches);}
  for(const side of[-1,1])for(let d=1.3;d<dist-1.3;d+=.5){const d1=Math.min(dist-1.3,d+.5),A=start.clone().addScaledVector(forward,d).addScaledVector(right,side*(width/2+.09)),B=start.clone().addScaledVector(forward,d1).addScaledVector(right,side*(width/2+.09)),y0=topAt(d)+1.03,y1=topAt(d1)+1.03,c=[A.clone().addScaledVector(right,-.04),B.clone().addScaledVector(right,-.04),B.clone().addScaledVector(right,.04),A.clone().addScaledVector(right,.04)];prism(c.map((q,k)=>q.clone().setY((k===0||k===3?y0:y1)-.08)).concat(c.map((q,k)=>q.clone().setY(k===0||k===3?y0:y1))),buffers.rails);if(Math.round((d-1.3)*2)%3===0)box(A.clone().setY(y0),right,forward,.08,1.03,.08,buffers.rails);}
  const maxRiser=Math.max(...levels.map((h,i)=>Math.abs(h-(i?levels[i-1]:exit.y)))),failures=terrainRows.filter(r=>r.ground===null||r.penetration>.03);if(maxRiser>.22||run<.28||maxRiser/run>.65)issues.push({type:'stair-dimensions',station,maxRiser,run});if(failures.length)issues.push({type:'known-terrain-or-missing-floor',station,count:failures.length,first:failures.slice(0,3)});
  for(const d of protectedDiscs)for(const p of path)if(Math.hypot(p[0]-d.center[0],p[2]-d.center[1])<d.radius+width/2)issues.push({type:'protected-landmark-circle',station,id:d.id});
  links.push({id,station,u,start:start.toArray(),end:end.toArray(),length:dist,width,roofPlaneLength:landingLength,railClearanceHeight:walkwayHeight,stepCount:count,maximumRiser:maxRiser,minimumRun:run,endpointActualFloorSamples:selected.floor,endpointSeaY:selected.sea,treadNosing:.04,walkSurfaces:surfaces,walkPath:path,foundations:foundationRows,terrainRows,terrainFailures:failures,accepted:false});
  openings.push({origin:start,forward,right,width:width+.5,back:.75,length:landingLength+.25});walkPaths.push({id,points:path,kind:'discrete-stairs',mainCityConnection:false});
 }
 for(const [key,positions]of Object.entries(buffers)){if(!positions.length)continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.computeBoundingBox();geoms.push(g);const m=new T.MeshStandardMaterial({color:palette[key]??(key==='rails'?'#8b7e69':TARGET_ARCHITECTURE_PALETTE.stone),roughness:.92});m.userData.preserveCitadelMaterial=true;mats.push(m);const mesh=new T.Mesh(g,m);mesh.name='target-new-city-transit-'+key;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.targetWalkable=key==='treads';group.add(mesh);}
 // Actual triangle/OBB test of these new meshes against both loaded rail lanes.
 group.updateMatrixWorld(true);const triangles=[];group.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i+=3){const tri=new T.Triangle(...[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(a,i+j).applyMatrix4(matrix)));triangles.push({name:o.name,tri,box:new T.Box3().setFromPoints([tri.a,tri.b,tri.c])});}});
 const e={halfWidth:2.32,halfLength:3.49,bottom:-.6,top:5.71,...vehicleEnvelope},body=new T.Box3(new T.Vector3(-e.halfWidth,e.bottom,-e.halfLength),new T.Vector3(e.halfWidth,e.top,e.halfLength)),collisions=[];let poses=0;
 for(const lane of['red','blue']){const c=release.curves[lane],count=Math.ceil(c.getLength()/.75);for(let i=0;i<=count;i++){const p=c.getPointAt(i/count),t=c.getTangentAt(i/count).normalize(),r=p.clone().normalize().cross(t).normalize(),up=t.clone().cross(r).normalize(),pose=new T.Matrix4().makeBasis(r,up,t).setPosition(p),inv=pose.clone().invert(),b=body.clone().applyMatrix4(pose);poses++;for(const q of triangles){if(!b.intersectsBox(q.box))continue;const tri=q.tri.clone();tri.a.applyMatrix4(inv);tri.b.applyMatrix4(inv);tri.c.applyMatrix4(inv);if(body.intersectsTriangle(tri)){collisions.push({lane,u:i/count,mesh:q.name});break;}}}}
 if(collisions.length)issues.push({type:'loaded-vehicle-triangle-collision',count:collisions.length});
 const report={version:TARGET_NEW_CITY_TRANSIT_LINKS_VERSION,enabled:true,built:links.length===2,accepted:false,finitePass:links.length===2&&!issues.length,links,trials,issues,vehicleClearance:{pass:!collisions.length,poses,envelope:e,collisions,continuous:false},navigation:{targetWalkable:true,joinedSceneVerified:false},performance:{meshes:group.children.length,triangles:triangles.length},limitations:['Actual mesh-sampled plaza endpoints, not nominal ellipse points.','Gallery rail openings must be applied by the owner before joined navigation validation.','Finite terrain and cargo checks; GPU, actors and live pedestrian traversal require integration.']};
 return{group,report,openings,walkPaths,dispose};
 }catch(error){dispose();throw error;}
}
