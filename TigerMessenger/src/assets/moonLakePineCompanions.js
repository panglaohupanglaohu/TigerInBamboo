import * as T from 'three';
import {mergeStaticGroup} from '../world/geometryMerge.js';
import {getToonGradient} from './toon.js';

// Greg target v2: four authored silhouettes, independent of the old landmark.
// Coordinates are lake tangent metres. Branch starts sit inside the tapered trunk.
const POSES={
 lean:{id:2,trunk:[[0,0,0],[-.5,1.15,.06],[-1.65,2.4,.14],[-2.65,3.45,.2],[-2.35,4.55,.13],[-1.15,5.75,.1]],arms:[
  [[-1.7,2.45,.15],[-3.2,2.6,.35],[-4.65,3.0,.45]],
  [[-2.6,3.4,.2],[-4.0,3.8,.1],[-5.25,4.25,.15]],
  [[-2.5,4.15,.17],[-.7,4.25,-.3],[1.15,4.65,-.5]],
  [[-2.2,4.7,.12],[-2.9,5.4,.45],[-3.65,5.8,.6]],
  [[-1.5,5.4,.1],[-.7,5.85,.05],[.15,5.95,0]]
 ],crowns:[[-4.45,3.2,.45,2.7,1.6,.25],[-5.05,4.45,.15,3.0,1.7,.25],[.75,4.85,-.5,3.0,1.8,.29],[-3.45,5.95,.6,3.1,1.8,.28],[-.35,6.1,0,2.8,1.65,.28]]},
 spread:{id:4,trunk:[[0,0,0],[-.65,.9,.08],[-1.4,1.7,.2],[-.65,2.6,.1],[.15,3.5,-.05],[-.35,4.2,0]],arms:[
  [[-1.3,1.8,.2],[-2.65,2.0,.4],[-3.7,2.3,.45]],
  [[-.7,2.6,.1],[1.2,2.65,-.15],[2.7,3.0,-.3]],
  [[.1,3.4,-.05],[-1.4,3.5,.6],[-2.5,3.85,.8]],
  [[-.2,3.95,0],[.75,4.25,-.1],[1.3,4.35,-.15]]
 ],crowns:[[-3.45,2.5,.45,2.6,1.6,.23],[2.3,3.2,-.3,2.9,1.7,.25],[-2.15,4.0,.8,2.5,1.6,.24],[.7,4.5,-.15,2.6,1.65,.24]]},
 windswept:{id:5,trunk:[[0,0,0],[-.5,.9,.1],[-1.55,1.85,.15],[-2.8,2.65,.1],[-3.8,3.2,.18]],arms:[
  [[-1.5,1.8,.15],[-3.7,1.95,.5],[-5.5,2.25,.7]],
  [[-2.7,2.6,.1],[-2.5,3.55,-.2],[-1.85,3.85,-.35]],
  [[-.65,1.15,.12],[1.0,1.85,-.25],[2.45,2.1,-.4]],
  [[-3.6,3.1,.17],[-4.75,3.4,.2],[-5.7,3.5,.2]]
 ],crowns:[[-5.05,2.45,.7,3.5,1.9,.25],[-1.95,4.0,-.35,3.3,1.9,.27],[2.05,2.3,-.4,3.4,1.8,.25],[-5.4,3.65,.2,3.1,1.8,.26]]},
 arching:{id:6,trunk:[[0,0,0],[.4,1.25,.04],[1.2,2.55,.15],[.8,3.65,.22],[-.35,4.45,.12],[-1.55,4.7,.05]],arms:[
  [[1.1,2.6,.15],[-.7,2.85,.55],[-2.4,3.1,.8],[-3.7,3.6,.9]],
  [[.85,3.6,.22],[2.35,3.65,-.2],[3.7,4.05,-.4]],
  [[-.3,4.4,.13],[-.15,5.35,.1],[.5,5.65,0]],
  [[-1.1,4.65,.07],[-2.1,5.0,.35],[-3.2,5.15,.4]]
 ],crowns:[[-3.25,3.8,.9,3.4,1.9,.27],[3.25,4.25,-.4,3.0,1.7,.25],[.25,5.8,0,3.1,1.85,.28],[-2.8,5.3,.4,3.2,1.8,.26]]}
};

export function createMoonLakeCompanionPine({role='lean'}={}){
 const pose=POSES[role];if(!pose)throw new TypeError('Unknown moon-lake pine role');
 const group=new T.Group();group.name='moon-lake-pine-'+pose.id+'-'+role;
 const bark=new T.MeshToonMaterial({color:'#8e7a65',gradientMap:getToonGradient()});
 const leaf=new T.MeshToonMaterial({color:0xffffff,vertexColors:true,gradientMap:getToonGradient()});
 const ink=new T.MeshBasicMaterial({color:'#354e43',side:T.BackSide});
 const seam=new T.MeshBasicMaterial({color:'#645748'});
 const mats=[bark,leaf,ink,seam];
 let limbCount=0,leafPlateCount=0;
 function limb(points,r0,r1,material=bark,segments=20){
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),geo=new T.TubeGeometry(curve,segments,1,8,false),p=geo.attributes.position;
  for(let i=0;i<=segments;i++){
   const center=curve.getPointAt(i/segments),radius=T.MathUtils.lerp(r0,r1,Math.pow(i/segments,.76));
   for(let j=0;j<=8;j++){const k=i*9+j,v=new T.Vector3().fromBufferAttribute(p,k).sub(center).multiplyScalar(radius).add(center);p.setXYZ(k,v.x,v.y,v.z);}
  }
  geo.computeVertexNormals();const m=new T.Mesh(geo,material);m.castShadow=m.receiveShadow=true;group.add(m);limbCount++;return curve;
 }
 const rootRadius=role==='windswept'?.73:role==='spread'?.59:.75;
 const trunkCurve=limb(pose.trunk,rootRadius,.12,bark,40);
 pose.arms.forEach((a,i)=>limb(a,i===0?.31:.25-i*.018,.055));
 // Broad roots enter the existing soil; there is no new planter or terrain plate.
 for(let i=0;i<6;i++){
  const a=i*Math.PI*2/6+.2,r=role==='spread'?1.2:1.5;
  limb([[0,.22,0],[Math.cos(a)*r*.5,.1,Math.sin(a)*r*.5],[Math.cos(a)*r,-.06,Math.sin(a)*r]],rootRadius*.4,.02,bark,10);
 }
 // Sparse structural bark seams follow the actual curve, without dense hatching.
 for(const angle of [.3,2.6,4.6]){
  const pts=[];
  for(let i=0;i<15;i++){
   const t=.045+i*.06,c=trunkCurve.getPointAt(t),radius=T.MathUtils.lerp(rootRadius,.12,Math.pow(t,.76));
   const tangent=trunkCurve.getTangentAt(t).normalize();
   const side=new T.Vector3(0,0,1).cross(tangent).normalize(),up=new T.Vector3().crossVectors(tangent,side).normalize();
   c.addScaledVector(side,Math.cos(angle)*radius*.995).addScaledVector(up,Math.sin(angle)*radius*.995);pts.push(c.toArray());
  }
  limb(pts,.012,.006,seam,20);
 }
 // A needle cloud is an irregular shallow solid with a continuous dark underside.
 // Its perimeter is authored mathematically; no sphere/icosahedron crown primitives.
 function plate(x,y,z,w,d,h,seed,turn){
  const n=28,verts=[],colors=[],indices=[];
  const top=new T.Color('#8c9b53'),rim=new T.Color('#647f43'),bottom=new T.Color('#294e3c');
  for(let ring=0;ring<3;ring++)for(let j=0;j<n;j++){
   const a=j*Math.PI*2/n;
   const scallop=1+.095*Math.sin(a*7+seed)+.045*Math.sin(a*11+seed*.7)+.04*Math.cos(a*3-seed);
   const radial=ring===0?.52:ring===1?1:.81;
   const yy=ring===0?h*.8:ring===1?-.03:-h*.65;
   verts.push(Math.cos(a)*w*.5*scallop*radial,yy+Math.sin(a*3+seed)*h*.13,Math.sin(a)*d*.5*scallop*radial);
   const col=(ring===0?top:ring===1?rim:bottom).clone().multiplyScalar(1+.035*Math.sin(a*3+seed));colors.push(col.r,col.g,col.b);
  }
  const topI=verts.length/3;verts.push(0,h,0);colors.push(top.r,top.g,top.b);
  const bottomI=verts.length/3;verts.push(0,-h*.85,0);colors.push(bottom.r,bottom.g,bottom.b);
  for(let j=0;j<n;j++){
   const k=(j+1)%n;
   indices.push(topI,k,j);
   indices.push(j,k,n+j,k,n+k,n+j);
   indices.push(n+j,n+k,2*n+j,n+k,2*n+k,2*n+j);
   indices.push(bottomI,2*n+j,2*n+k);
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,leaf);mesh.position.set(x,y,z);mesh.rotation.y=turn;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  // A very thin physical inverse hull, merged by material after all plates exist.
  const edgeGeo=geo.clone(),ep=edgeGeo.attributes.position,en=edgeGeo.attributes.normal;
  for(let k=0;k<ep.count;k++){ep.setXYZ(k,ep.getX(k)+en.getX(k)*.014,ep.getY(k)+en.getY(k)*.014,ep.getZ(k)+en.getZ(k)*.014);}
  const edge=new T.Mesh(edgeGeo,ink);edge.position.copy(mesh.position);edge.rotation.copy(mesh.rotation);edge.raycast=()=>{};group.add(edge);leafPlateCount++;
 }
 pose.crowns.forEach(([x,y,z,w,d,h],ci)=>{
  // Branchlet tips support three overlapping horizontal pads, rather than balls.
  for(let j=0;j<3;j++){
   const dx=(j-1)*w*.28,dz=(j===1?-.18:.15)*d;
   const tip=[x+dx,y-.05+(j===1?.09:0),z+dz];
   const start=pose.arms[ci].at(-1); // Exact existing limb endpoint: continuous support.
   limb([start,[x+dx*.55,y-.15,z+dz*.55],tip],.07,.018,bark,8);
   plate(tip[0],tip[1]+.14,tip[2],w*(j===1?.84:.72),d*(j===1?.94:.83),h,pose.id*7+ci*3+j,ci*.36+j*.17);
  }
 });
 mergeStaticGroup(group,{mergedTag:'moon-companion-'+role});
 const bounds=new T.Box3().setFromObject(group),report={version:3,displayScale:1,id:pose.id,role,source:'Greg approved target v2; authored curved trunk/horizontal branches/irregular needle plates',trunk:pose.trunk,arms:pose.arms,crowns:pose.crowns,rootRadius:role==='spread'?1.25:1.55,trunkBaseRadius:rootRadius,limbCount,leafPlateCount,crownPrimitive:'custom irregular flattened solid; no sphere',localBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},meshes:0,triangles:0};
 group.traverse(o=>{if(o.isMesh){report.meshes++;report.triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});group.userData.moonLakePine=report;
 let disposed=false;return{group,report,dispose(){if(disposed)return;disposed=true;group.removeFromParent();const geometries=new Set();group.traverse(o=>{if(o.isMesh)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());group.clear();}};
}
