import * as T from 'three';
import {mergeStaticGroup} from '../world/geometryMerge.js';

// Hand-authored poses; no scaled copies of the original landmark pine.
const POSES={
 lean:{id:2,trunk:[[0,0,0],[.25,1,.05],[.9,2.1,.1],[1.15,3.35,.15],[2.05,4.9,.2]],arms:[[[.8,2,.1],[-.5,2.55,.05],[-2.1,2.9,.15]],[[1.05,3.2,.15],[2.7,3.55,-.2],[4.1,3.9,-.25]],[[1.7,4.4,.2],[2.5,4.9,.1],[3.0,5.2,0]]],crowns:[[-1.7,3.05,.1,2.7,1.35,.27],[3.65,4.1,-.2,2.8,1.45,.27],[2.65,5.35,.1,2.7,1.6,.30]]},
 spread:{id:4,trunk:[[0,0,0],[-.55,1.1,0],[-1.15,2.3,.1],[-.1,3.6,.15],[.7,5.2,.1]],arms:[[[-1.1,2.25,.1],[-2.2,2.8,.35],[-3.7,3.15,.4]],[[-.2,3.4,.15],[2.4,3.45,-.1],[4.1,4.0,-.15]],[[.5,4.7,.1],[-.7,5.3,0],[-1.6,5.5,0]]],crowns:[[-3.1,3.35,.4,3.2,1.5,.27],[3.3,4.2,-.15,3.4,1.7,.29],[-.6,5.7,0,3.1,1.5,.30]]},
 windswept:{id:5,trunk:[[0,0,0],[-.35,.8,.1],[-1.35,1.6,.15],[-2.6,2.55,.1]],arms:[[[-1,1.4,.1],[-3.2,1.8,.2],[-4.8,2.2,.2]],[[-.6,1.05,.1],[.55,1.7,-.3],[1.0,2.15,-.5]]],crowns:[[-4.0,2.4,.2,3.2,1.4,.25],[-2.1,2.9,.1,2.9,1.5,.27],[.7,2.35,-.45,2.0,1.0,.21]]},
 arching:{id:6,trunk:[[0,0,0],[-.45,.95,.05],[-1.2,1.9,.25],[-2.25,2.6,.4],[-3.25,2.8,.25]],arms:[[[-.8,1.5,.15],[-.65,2.9,.1],[-1.15,4.0,0]],[[-2.1,2.5,.35],[-3.6,3.0,.3],[-4.35,3.7,.2]],[[-1.2,1.9,.25],[-.2,2.15,1.25],[.45,2.8,1.7]]],crowns:[[-1.1,4.15,0,2.1,1.2,.24],[-4.0,3.85,.2,2.6,1.3,.25],[.25,2.95,1.55,1.8,1.1,.22]]}
};

export function createMoonLakeCompanionPine({role='lean'}={}){
 const pose=POSES[role];if(!pose)throw new TypeError('Unknown moon-lake pine role');
 const group=new T.Group();group.name='moon-lake-pine-'+pose.id+'-'+role;
 const mats=[new T.MeshStandardMaterial({color:'#897a65',roughness:1}),...['#476d53','#678b5c','#88a268'].map(color=>new T.MeshStandardMaterial({color,roughness:1,flatShading:true}))];
 function limb(points,r0,r1){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),geo=new T.TubeGeometry(curve,22,1,7,false),p=geo.attributes.position;
  for(let i=0;i<=22;i++){const center=curve.getPointAt(i/22),radius=T.MathUtils.lerp(r0,r1,Math.pow(i/22,.8));for(let j=0;j<=7;j++){const k=i*8+j,v=new T.Vector3().fromBufferAttribute(p,k).sub(center).multiplyScalar(radius).add(center);p.setXYZ(k,v.x,v.y,v.z);}}
  geo.computeVertexNormals();const m=new T.Mesh(geo,mats[0]);m.castShadow=m.receiveShadow=true;group.add(m);
 }
 limb(pose.trunk,role==='windswept'?.34:.38,.055);pose.arms.forEach((a,i)=>limb(a,.17-i*.025,.025));
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5+.2,r=role==='windswept'?1.05:1.2;limb([[0,.17,0],[Math.cos(a)*r*.55,.07,Math.sin(a)*r*.55],[Math.cos(a)*r,-.035,Math.sin(a)*r]],.15,.015);}
 pose.crowns.forEach(([x,y,z,w,d,h],ci)=>{for(let j=0;j<5;j++){const a=j*2.39996,m=new T.Mesh(new T.IcosahedronGeometry(1,1),mats[1+(j+ci)%3]);m.position.set(x+Math.cos(a)*w*(j===0?.04:.24),y+(j%3)*h*.62,z+Math.sin(a)*d*.23);m.scale.set(w*(.27+(j%2)*.055),h*(1.8+(j%3)*.18),d*(.34+(j%2)*.07));m.rotation.set(.09*Math.sin(a),a*.25,.05*Math.cos(a));m.castShadow=m.receiveShadow=true;group.add(m);}});
 const displayScale={lean:1.2,spread:1.25,windswept:1.45,arching:1.3}[role];group.scale.setScalar(displayScale);

 mergeStaticGroup(group,{mergedTag:'moon-companion-'+role});
 const bounds=new T.Box3().setFromObject(group),report={version:2,displayScale,id:pose.id,role,source:'individually authored trunk/arms/crown plates',trunk:pose.trunk,arms:pose.arms,crowns:pose.crowns,rootRadius:(role==='windswept'?1.05:1.2)*displayScale,localBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},meshes:0,triangles:0};
 group.traverse(o=>{if(o.isMesh){report.meshes++;report.triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});group.userData.moonLakePine=report;
 let disposed=false;return{group,report,dispose(){if(disposed)return;disposed=true;group.removeFromParent();const geometries=new Set();group.traverse(o=>{if(o.isMesh)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());group.clear();}};
}
