import * as THREE from 'three';
import {applySwampCoralWeathering} from './swampCoralWeathering.js';
import {GREG_LAKE_PALETTE as P} from './swampGregVisuals.js';
import {createSwampLivingPathConstraints} from './swampGregLivingPaths.js';

// Natural wall growth is attached to the *current mesh*, never to the older
// analytic bowl. All geometry and clearance records use INNER-local units.
export function createSwampCliffSampler(inner,wall=inner.getObjectByName('swamp-sinkhole-wall')){
 if(!wall?.geometry?.attributes.position)return null;
 inner.updateWorldMatrix(true,true);
 const matrix=inner.matrixWorld.clone().invert().multiply(wall.matrixWorld),p=wall.geometry.attributes.position,ix=wall.geometry.index,triangles=[];
 for(let i=0,n=ix?ix.count:p.count;i<n;i+=3){
  const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(matrix));
  triangles.push({points,minY:Math.min(...points.map(v=>v.y)),maxY:Math.max(...points.map(v=>v.y))});
 }
 return (angle,y)=>{
  const origin=new THREE.Vector3(0,y,0),ray=new THREE.Ray(origin,new THREE.Vector3(Math.cos(angle),0,Math.sin(angle))),hit=new THREE.Vector3();let best=null,distance=Infinity;
  for(const triangle of triangles){
   if(y<triangle.minY-1e-7||y>triangle.maxY+1e-7)continue;
   if(ray.intersectTriangle(...triangle.points,false,hit)){
    const d=hit.distanceToSquared(origin);if(d<distance){distance=d;best=hit.clone();}
   }
  }
  return best;
 };
}

export function installSwampNaturalCliff(swamp,{enabled=new URLSearchParams(globalThis.location?.search||'').get('gregNaturalCliff')!=='0'}={}){
 const inner=swamp.userData.inner||swamp;
 if(inner.userData.gregNaturalCliff)return inner.userData.gregNaturalCliff;
 if(!enabled)return null;
 const wall=inner.getObjectByName('swamp-sinkhole-wall'),wallAt=createSwampCliffSampler(inner,wall),constraints=createSwampLivingPathConstraints(inner);
 if(!wallAt||!constraints)return {ok:false,reason:'current wall and three-bank route required'};
 const originalWallMaterial=wall.material,weatheredWallMaterial=wall.material.clone();
 weatheredWallMaterial.onBeforeCompile=originalWallMaterial.onBeforeCompile;weatheredWallMaterial.customProgramCacheKey=originalWallMaterial.customProgramCacheKey;
 applySwampCoralWeathering(weatheredWallMaterial,{matrix:inner.matrixWorld.clone().invert().multiply(wall.matrixWorld)});wall.material=weatheredWallMaterial;
 const root=new THREE.Group();root.name='greg-natural-cliff';
 const batches={rock:{p:[],c:[]},growth:{p:[],c:[]}},ink=[],pockets=[],plants=[],vines=[],rockBands=[],fissurePlants=[],rejected=[];
 const color=hex=>new THREE.Color(hex),stone=color(P.wall).lerp(color(P.warm),.1),leaf=color(P.foliage),darkLeaf=color(P.foliageShade),rootColor=color(P.bark),coralStone=color(P.stone).lerp(color(P.warm),.12),coolStone=color(P.wallShade);
 function tri(batch,a,b,c,tint){batch.p.push(...a,...b,...c);for(let i=0;i<3;i++)batch.c.push(tint.r,tint.g,tint.b);}
 function line(a,b){ink.push(...a,...b);}
 function tube(points,radius,tint){
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],direction=b.clone().sub(a),length=direction.length();if(length<1e-5)continue;
   const source=new THREE.CylinderGeometry(radius*(1-i/points.length*.45),radius*(1-(i-1)/points.length*.45),length,5,1,false),geo=source.toNonIndexed();source.dispose();
   const matrix=new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()),new THREE.Vector3(1,1,1)),p=geo.attributes.position;
   for(let j=0;j<p.count;j+=3)tri(batches.growth,...[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,j+k).applyMatrix4(matrix)),tint);
   geo.dispose();
  }
 }
 // Six irregular habitat patches; unequal heights, sizes and gaps deliberately
 // replace the old 3 x 12 shelf grid. The entrance quadrant remains unobstructed.
 const sites=[
  [1.26,36.9,3.8,1.55],[1.37,33.3,2.6,1.15],[1.22,28.7,3.0,1.3],
  [1.98,38.1,3.1,1.4],[2.12,34.8,4.0,1.7],[1.92,31.7,2.4,1.1],
  [2.68,36.0,4.3,1.8],[2.83,31.5,2.9,1.3],[2.65,28.1,2.3,1.0],
  [-2.7,38.0,2.5,1.2],[-2.55,34.0,3.8,1.65],[-2.75,29.0,3.1,1.35],
  [-1.88,37.2,3.4,1.4],[-1.75,32.6,2.7,1.2],[-1.93,27.5,2.9,1.4],
  [-.86,38.2,2.8,1.2],[-.72,34.1,3.5,1.6],[-.91,28.4,2.4,1.2],
 ];
 for(const [id,site] of sites.entries()){
  const [angle,y,width,depth]=site,anchor=wallAt(angle,y);if(!anchor){rejected.push({id,reason:'no wall'});continue;}
  const radius=Math.hypot(anchor.x,anchor.z),centreDepth=depth*.38,centre=anchor.clone().addScaledVector(new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),-centreDepth);
  const height=Math.min(y-25.35,3.9+(id%4)*.57),footY=y-height,inspection=constraints.inspectPlant({position:[centre.x,footY,centre.z],radius:width*.9,height:height+2.6});
  if(!inspection.allowed){rejected.push({id,reasons:inspection.reasons});continue;}
  const top=[],bottom=[],backSamples=[],frontSamples=[];
  let valid=true;
  for(let k=0;k<11;k++){
   const phi=k/11*Math.PI*2,irregular=.9+.12*Math.sin(k*2.7+id*.83),offset=Math.sin(phi)*width*.5*irregular,a=angle+offset/radius;
   // The lower join spreads diagonally *along* the wall instead of converging
   // into a hanging bowl. Each long shoulder is buried back into the cliff.
   const lowerAngle=angle+(offset*1.6+width*.2*Math.sin(id*2.1))/radius;
   const surface=wallAt(a,y),lowerSurface=wallAt(lowerAngle,footY+.12*(1+Math.sin(k*1.7+id)));if(!surface||!lowerSurface){valid=false;break;}
   const d=centreDepth+Math.cos(phi)*(depth*.62+.26)*irregular,outward=new THREE.Vector3(Math.cos(a),0,Math.sin(a));
   const v=surface.clone().addScaledVector(outward,-d),b=lowerSurface.clone().addScaledVector(new THREE.Vector3(Math.cos(lowerAngle),0,Math.sin(lowerAngle)),.16);top.push(v);bottom.push(b);
   if(d<0)backSamples.push({point:v.toArray(),wall:surface.toArray(),embedded:-d});else frontSamples.push({point:v.toArray(),wall:surface.toArray(),depth:d});
  }
  if(!valid||!backSamples.length){rejected.push({id,reason:'incomplete embedded pocket'});continue;}
  const lowerCentre=wallAt(angle,footY).addScaledVector(new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),.2);
  for(let k=0;k<top.length;k++){
   const j=(k+1)%top.length;
   tri(batches.rock,centre,top[j],top[k],coralStone);
   tri(batches.rock,top[k],top[j],bottom[k],stone);tri(batches.rock,top[j],bottom[j],bottom[k],coolStone);
   tri(batches.rock,lowerCentre,bottom[k],bottom[j],stone);
   if(k===2)line(top[k].clone().lerp(bottom[k],.3),top[k].clone().lerp(bottom[k],.72));
  }
  const record={id,angle,y,width,depth,height,centre:centre.toArray(),top:top.map(p=>p.toArray()),bottom:bottom.map(p=>p.toArray()),backSamples,frontSamples,clearance:{position:[centre.x,footY,centre.z],radius:width*.9,height:height+2.6}};pockets.push(record);
  // Three root crowns per patch. Leaves grow continuously from that shared
  // crown; no pots, stems suspended above a tray, or separate green rods.
  const exposed=frontSamples.slice().sort((a,b)=>b.depth-a.depth).slice(0,3);
  for(let n=0;n<2+(id%2);n++){
   const base=centre.clone().lerp(new THREE.Vector3(...exposed[n%exposed.length].point),.51+.06*(n%2));base.y=y+.02;
   let scale=1.05+.31*((id+n)%3);
   while(scale>.55&&!constraints.inspectPlant({position:base.toArray(),radius:scale*1.4,height:scale*1.6}).allowed)scale*=.8;
   if(scale<=.55)continue;
   const plantHeight=scale*1.6;plants.push({pocket:id,position:base.toArray(),radius:scale*1.4,height:plantHeight,scale});
   for(let f=0;f<7;f++){
    const direction=angle+Math.PI+(f-3)*.34+n*.15,length=scale*(.9+.16*(f%3)),tip=base.clone().add(new THREE.Vector3(Math.cos(direction)*length,scale*(.12+.08*(f%3)),Math.sin(direction)*length));
    const side=new THREE.Vector3(-Math.sin(direction),0,Math.cos(direction)),curve=t=>base.clone().lerp(tip,t).add(new THREE.Vector3(0,Math.sin(t*Math.PI)*scale*(.92+.08*(f%2)),0));
    for(let j=0;j<5;j++){
     const t=j/5,u=(j+1)/5,a=curve(t),b=curve(u),wa=Math.sin(t*Math.PI)*scale*.27,wb=Math.sin(u*Math.PI)*scale*.27;
     tri(batches.growth,a.clone().addScaledVector(side,wa),b.clone().addScaledVector(side,wb),a.clone().addScaledVector(side,-wa),leaf);
     tri(batches.growth,a.clone().addScaledVector(side,-wa),b.clone().addScaledVector(side,wb),b.clone().addScaledVector(side,-wb),darkLeaf);
     if(f===1||f===4)line(a,b);
    }
   }
  }
 }
 // Broad eroded buttresses descend continuously from the existing rim seam.
 // Their sides and ends meet the actual wall. This replaces the visual reading
 // of isolated dishes on a smooth cylinder without changing the collision wall.
 const bands=[
  {angle:1.29,width:.62,bottom:28.1,lean:.045,relief:1.92},
  {angle:2.06,width:.80,bottom:27.4,lean:-.065,relief:2.35},
  {angle:2.74,width:.72,bottom:26.2,lean:.025,relief:2.08},
  {angle:-2.61,width:.74,bottom:26.8,lean:-.07,relief:2.42},
  {angle:-1.82,width:.61,bottom:28.6,lean:.035,relief:1.65},
  {angle:-.81,width:.70,bottom:29.2,lean:-.03,relief:1.83},
 ];
 for(const [id,band] of bands.entries()){
  const grid=[],rows=15,columns=10,vertices=[];
  for(let j=0;j<=rows;j++){
   const t=j/rows,y=THREE.MathUtils.lerp(40,band.bottom,t),row=[];
   const axis=band.angle+band.lean*t+Math.sin(t*5+id)*.02;
   const width=band.width*(.72+.22*Math.sin(t*3.5+id*.5)+.08*Math.cos(t*13));
   for(let k=0;k<=columns;k++){
    const u=k/columns,a=axis+(u-.5)*width;
    // Warped bedding height breaks the machined, evenly spaced wall courses.
    // Both ends remain on the authored top/bottom seam.
    const yy=y+Math.sin(Math.PI*t)*(.32*Math.sin(u*7+id*.9)+.13*Math.sin(t*12+u*4)),surface=wallAt(a,yy);
    if(!surface){row.push(null);continue;}
    const pocket=pockets.filter(p=>Math.floor(p.id/3)===id).reduce((m,p)=>Math.max(m,Math.exp(-Math.pow((yy-p.y)/.65,2))),0);
    const envelope=Math.sin(u*Math.PI)**.65*Math.sin(t*Math.PI)**.5;
    const facets=.58+.22*Math.cos(u*8+t*3+id)+.13*Math.sin(t*17+u*4+id*.7);
    const depth=band.relief*envelope*facets*(1-pocket*.78);
    const point=surface.clone().addScaledVector(new THREE.Vector3(Math.cos(a),0,Math.sin(a)),-depth);
    const valid=constraints.inspectPlant({position:point.toArray(),radius:.22,height:.28}).allowed;
    // Large coherent planes, rather than per-triangle noise: a cliff shoulder
    // catches warm light while its cleft keeps the cool slate of the lake wall.
    const facet=Math.floor(k/2),warmPlane=(facet+id)%3===0;
    const tint=stone.clone().lerp(warmPlane?coralStone:color(P.wall),warmPlane?(t<.30?.88:.60):.24)
     .multiplyScalar(.91+.045*Math.sin(facet*1.9+id)+.025*Math.cos(t*5));
    row.push({point,surface,valid,tint});
    vertices.push({point:point.toArray(),surface:surface.toArray(),depth,valid});
   }grid.push(row);
  }
  let triangles=0;
  for(let j=0;j<rows;j++)for(let k=0;k<columns;k++){
   const corners=[grid[j][k],grid[j+1][k],grid[j][k+1],grid[j+1][k+1]];
   for(const indices of [[0,1,2],[2,1,3]]){
    const points=indices.map(i=>corners[i]);if(points.some(p=>!p?.valid))continue;
    tri(batches.rock,...points.map(p=>p.point),corners[0].tint);triangles++;
   }
   // Discontinuous geological seams; no regular brick grid or horizontal rings.
   if((j===4||j===9)&&k>1&&k<columns-2&&corners[0]?.valid&&corners[2]?.valid){
    const offset=v=>v.point.clone().addScaledVector(new THREE.Vector3(-v.point.x,0,-v.point.z).normalize(),.008);
    line(offset(corners[0]),offset(corners[2]));
   }
   // Broken vertical clefts give the broad planes a geological direction.
   // Their offset lies toward the lake, on the visible relief face.
   if((k===3||k===7)&&j>1&&j<rows-1&&j%5!==2&&corners[0]?.valid&&corners[1]?.valid){
    const offset=v=>v.point.clone().addScaledVector(new THREE.Vector3(-v.point.x,0,-v.point.z).normalize(),.018);
    line(offset(corners[0]),offset(corners[1]));
   }
  }
  rockBands.push({id,...band,vertices,triangles});
 }
 // Roots and epiphytes must sit on the newly rendered relief too, not disappear
 // behind it. Sample the combined rock front, including the embedded pockets.
 function rockAt(angle,y){
  const origin=new THREE.Vector3(0,y,0),ray=new THREE.Ray(origin,new THREE.Vector3(Math.cos(angle),0,Math.sin(angle))),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),hit=new THREE.Vector3();
  let best=wallAt(angle,y),distance=best?best.distanceToSquared(origin):Infinity;
  const p=batches.rock.p;
  for(let i=0;i<p.length;i+=9){
   if(y<Math.min(p[i+1],p[i+4],p[i+7])-1e-7||y>Math.max(p[i+1],p[i+4],p[i+7])+1e-7)continue;
   a.fromArray(p,i);b.fromArray(p,i+3);c.fromArray(p,i+6);
   if(ray.intersectTriangle(a,b,c,false,hit)&&hit.distanceToSquared(origin)<distance){best=hit.clone();distance=best.distanceToSquared(origin);}
  }
  return best;
 }
 // Wide irregular bedding follows the real faces. Broken runs avoid turning
 // the bowl into either a brick grid or a stack of identical horizontal rings.
 const strata=[];
 for(const band of rockBands)for(let layer=0;layer<3;layer++){
  const y=[38.75,34.25,29.65][layer]+.43*Math.sin(band.id*1.8+layer);if(y<band.bottom+.5)continue;let previous=null;const samples=[];
  for(let k=0;k<=24;k++){
   const t=k/24,a=band.angle+(t-.5)*band.width*.85,yy=y+Math.sin(t*5+band.id)*.24+Math.sin(t*13+layer)*.09,hit=rockAt(a,yy);
   if(!hit||k===9+(band.id%3)){previous=null;continue;}
   const p=hit.clone().addScaledVector(new THREE.Vector3(-Math.cos(a),0,-Math.sin(a)),.018);
   if(!constraints.inspectPlant({position:p.toArray(),radius:.06,height:.12}).allowed){previous=null;continue;}
   samples.push(p.toArray());if(previous&&p.distanceTo(previous)<1.5)line(previous,p);previous=p;
  }strata.push({band:band.id,layer,samples});
 }
 // Growth follows broken vertical seams: varied fern sheets, hanging clusters
 // and a few open gaps. Their bases touch stone, rather than another small tray.
 for(const band of rockBands){
  for(let n=0;n<12;n++){
   const t=.055+.89*(n/11),y=40-(40-band.bottom)*t;
   if(n%7===4)continue;
   const angle=band.angle+band.lean*t+Math.sin(t*8+band.id)*.026+Math.sin(n*2.399)*band.width*.18;
   const surface=rockAt(angle,y);if(!surface)continue;
   const inward=new THREE.Vector3(-Math.cos(angle),0,-Math.sin(angle)),base=surface.clone().addScaledVector(inward,.014),size=.65+.82*(.5+.5*Math.sin(n*1.71+band.id));
   const clearance={position:[base.x,y-size*1.1,base.z],radius:size*.95,height:size*1.7};
   if(!constraints.inspectPlant(clearance).allowed)continue;
   const tangent=new THREE.Vector3(-Math.sin(angle),0,Math.cos(angle));
   fissurePlants.push({band:band.id,position:base.toArray(),surface:surface.toArray(),clearance,size});
   for(let f=0;f<5;f++){
    const spread=(f-2)/2,tip=base.clone().addScaledVector(tangent,spread*size*.7).addScaledVector(inward,.15+size*.3).add(new THREE.Vector3(0,-size*(.5+Math.abs(spread)*.36),0));
    const bend=base.clone().lerp(tip,.56).addScaledVector(inward,.18),cross=tangent.clone().multiplyScalar(size*.25);
    tri(batches.growth,base,bend.clone().add(cross),tip,f%2?leaf:darkLeaf);tri(batches.growth,base,tip,bend.clone().sub(cross),f%2?darkLeaf:leaf);
    if(f===2){line(base,bend);line(bend,tip);}
   }
  }
 }
 // Sparse, wall-hugging root seams connect patches within a habitat, following
 // every intervening height of the actual wall instead of spanning the bowl.
 for(let group=0;group<6;group++){
  const cluster=pockets.filter(p=>Math.floor(p.id/3)===group).sort((a,b)=>b.y-a.y);if(cluster.length<2)continue;
  const a=cluster[0],b=cluster.at(-1),points=[],surfaceSamples=[];let allowed=true;
  const count=Math.ceil((a.y-b.y)/.08);
  for(let i=0;i<=count;i++){
   const t=i/count,y=THREE.MathUtils.lerp(a.y-.15,b.y+.08,t),angle=THREE.MathUtils.lerp(a.angle,b.angle,t)+.105+Math.sin(t*Math.PI*3)*.006;
   const surface=rockAt(angle,y);if(!surface){allowed=false;break;}
   const point=surface.clone().addScaledVector(new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),-.025);
   if(!constraints.inspectPlant({position:point.toArray(),radius:.14,height:.2}).allowed){allowed=false;break;}
   points.push(point);surfaceSamples.push(surface.toArray());
  }
  // A seam may meet a clipped shoulder edge. Do not bridge such a gap with a
  // detached root: omit that strand while keeping the surrounding leaf patch.
  for(let i=1;allowed&&i<points.length;i++){
   const midpoint=points[i-1].clone().lerp(points[i],.5),angle=Math.atan2(midpoint.z,midpoint.x),surface=rockAt(angle,midpoint.y),original=wallAt(angle,midpoint.y);
   if(Math.min(...[surface,original].filter(Boolean).map(p=>p.distanceTo(midpoint)))>.1)allowed=false;
  }
  if(!allowed)continue;
  tube(points,.045,rootColor);vines.push({group,points:points.map(p=>p.toArray()),surfaceSamples});
  for(let i=5;i<points.length-2;i+=8){
   const base=points[i],angle=Math.atan2(base.z,base.x),tangent=new THREE.Vector3(-Math.sin(angle),.38,Math.cos(angle)).normalize().multiplyScalar(.22),inward=new THREE.Vector3(-Math.cos(angle),0,-Math.sin(angle)).multiplyScalar(.13);
   for(const sign of [-1,1]){const tip=base.clone().addScaledVector(tangent,sign).add(new THREE.Vector3(0,.11,0));tri(batches.growth,base,base.clone().lerp(tip,.5).add(inward),tip,leaf);}
  }
 }
 if(!pockets.length){wall.material=originalWallMaterial;weatheredWallMaterial.dispose();return {ok:false,reason:'no wall pockets clear protected routes',rejected};}
 const owned=[];
 for(const [name,data] of Object.entries(batches)){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.p,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(data.c,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false}));mesh.name=`greg-natural-cliff-${name}`;if(name==='rock')applySwampCoralWeathering(mesh.material);root.add(mesh);owned.push(mesh);
 }
 const lines=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(ink,3)),new THREE.LineBasicMaterial({color:P.ink,transparent:true,opacity:.48,toneMapped:false}));lines.name='greg-natural-cliff-ink';root.add(lines);owned.push(lines);
 const hidden=['v2-bank-rock-shelves','v2-bank-ferns','greg-swamp-rooted-ecology'].map(name=>inner.getObjectByName(name)).filter(Boolean).map(object=>({object,visible:object.visible}));
 for(const {object} of hidden)object.visible=false;
 inner.add(root);let disposed=false;
 const report={ok:true,version:8,root,wall,pockets,plants,vines,rockBands,strata,fissurePlants,rejected,hidden,drawCalls:owned.length,frame:'inner-swamp-local',wallGeometryUnchanged:true,walkMeshes:[],
  dispose(){if(disposed)return;disposed=true;if(wall.material===weatheredWallMaterial)wall.material=originalWallMaterial;weatheredWallMaterial.dispose();root.removeFromParent();for(const object of owned){object.geometry.dispose();object.material.dispose();}for(const item of hidden)item.object.visible=item.visible;if(inner.userData.gregNaturalCliff===report)delete inner.userData.gregNaturalCliff;}
 };
 inner.userData.gregNaturalCliff=report;return report;
}
