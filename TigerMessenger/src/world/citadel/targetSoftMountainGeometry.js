import * as T from 'three';

const smooth=(v,a,b)=>T.MathUtils.smoothstep(v,a,b);
const RIDGES=[{id:'old-main',a:[-103,-27],b:[-50,-33],width:34},{id:'new-main',a:[32,-32],b:[108,-10],width:32},{id:'central-saddle',a:[-29,-34],b:[21,-39],width:22}];
/** Explicit unbuilt rear-rock domain. Foreground galleries, harbors and both
 * construction footprints stay byte-identical. This is not global smoothing. */
export function citadelSoftMountainDomain(p){
 if(p.x< -88||(Math.abs(p.x-18)<2.5&&p.z< -7.5)||(Math.abs(p.z+10)<2.5&&p.x>15.5))return{weight:0,role:'exact-cut-collar'};
 if(p.y<=4||p.z>=-8||p.z<=-70||p.x<=-139||p.x>=139)return{weight:0,role:'protected'};
 // Outer city walls / back terraces are protected in addition to the core.
 if(p.x>=-116&&p.x<=-18&&p.z>=-22)return{weight:0,role:'old-city-support'};
 if(p.x>=18&&p.x<=136&&p.z>=-14)return{weight:0,role:'new-city-support'};
 let best=null;for(const ridge of RIDGES){const dx=ridge.b[0]-ridge.a[0],dz=ridge.b[1]-ridge.a[1],t=T.MathUtils.clamp(((p.x-ridge.a[0])*dx+(p.z-ridge.a[1])*dz)/(dx*dx+dz*dz),0,1),x=ridge.a[0]+t*dx,z=ridge.a[1]+t*dz,d=Math.hypot(p.x-x,p.z-z),weight=1-smooth(d,ridge.width*.6,ridge.width);if(!best||weight>best.weight)best={...ridge,x,z,weight};}
 const edge=smooth(p.y,4,10)*smooth(p.z,-70,-59)*(1-smooth(p.z,-29,-8));
 const cityOld=(p.x>=-122&&p.x<=-12)?1-smooth(p.z,-33,-22):1;
 const cityNew=(p.x>=12&&p.x<=139)?1-smooth(p.z,-27,-14):1;
 return{...best,weight:best.weight*edge*cityOld*cityNew,role:best.id==='central-saddle'?'saddle':p.y>31?'crown':'shoulder'};
}

/** Deterministic shape pass on the actual finalized remesh, before consumers.
 * Morphological shoulder expansion then constrained fairing use exact shared
 * positions. No new faces, no independent per-triangle jitter, no new models.
 * Every proposed move is checked against all incident oriented triangles. */
export function softenCitadelMountainGeometry(geometry,{toChart=new T.Matrix4(),enabled=true,iterations=3,maxHorizontal=3.2,maxVertical=2.6,castleMatrix,railPoints=[]}={}){
 if(!geometry?.attributes?.position||!toChart.elements.every(Number.isFinite)||Math.abs(toChart.determinant())<1e-12)throw new TypeError('finite mountain geometry and invertible chart required');
 const report={version:'citadel-soft-rear-landform-3-cut-collars',enabled,method:'semantic rear crown/shoulder/saddle morph and constrained shared-vertex fairing',iterations,movedVertices:0,movedCorners:0,protectedVertices:0,uniqueVertices:0,rejectedMoves:0,maxHorizontal:0,maxVertical:0,trianglesUnchanged:true,indexUnchanged:true,domains:{crown:0,shoulder:0,saddle:0},limits:{maxHorizontal,maxVertical},protectedByteChanges:0};
 if(!enabled)return report;
 const rails=railPoints.map(p=>p.isVector3?p:new T.Vector3().fromArray(p));
 const p=geometry.attributes.position,index=geometry.index,count=index?.count??p.count,ids=[],vertices=[],lookup=new Map(),faces=[],edges=new Map(),inverse=toChart.clone().invert();
 for(let i=0;i<p.count;i++){const local=new T.Vector3().fromBufferAttribute(p,i),key=local.toArray().join(',');let id=lookup.get(key);if(id===undefined){id=vertices.length;lookup.set(key,id);const point=local.clone().applyMatrix4(toChart),domain=citadelSoftMountainDomain(point);if(domain.weight>0&&castleMatrix&&rails.length){const world=point.clone().applyMatrix4(castleMatrix);if(rails.some(r=>world.distanceToSquared(r)<256)){domain.weight=0;domain.role='rail-guard';}}vertices.push({point,original:point.clone(),local,corners:[],adj:new Set(),faces:[],domain,locked:domain.weight<=1e-6});}vertices[id].corners.push(i);ids.push(id);}
 const normal=ii=>vertices[ii[1]].point.clone().sub(vertices[ii[0]].point).cross(vertices[ii[2]].point.clone().sub(vertices[ii[0]].point));
 for(let i=0;i<count;i+=3){const ii=[0,1,2].map(j=>ids[index?index.getX(i+j):i+j]),n=normal(ii),area=n.length();if(area<1e-15)throw new Error('soft mountain rejects degenerate input');const f=faces.length;faces.push({ii,n:n.normalize(),area});for(const id of ii)vertices[id].faces.push(f);for(let k=0;k<3;k++){const a=ii[k],b=ii[(k+1)%3],key=a<b?a+':'+b:b+':'+a;vertices[a].adj.add(b);vertices[b].adj.add(a);if(!edges.has(key))edges.set(key,{a,b,count:0});edges.get(key).count++;}}
 // Open cuts / nonmanifold contacts are hard boundaries. Never pull a cut lip
 // away from a structure or weld a different disconnected layer by proximity.
 for(const e of edges.values())if(e.count!==2){vertices[e.a].locked=true;vertices[e.b].locked=true;}
 report.uniqueVertices=vertices.length;report.protectedVertices=vertices.filter(v=>v.locked).length;
 const apply=(v,candidate)=>{const offset=candidate.clone().sub(v.original),horizontal=Math.hypot(offset.x,offset.z);if(horizontal>maxHorizontal){offset.x*=maxHorizontal/horizontal;offset.z*=maxHorizontal/horizontal;}offset.y=T.MathUtils.clamp(offset.y,-maxVertical,maxVertical);candidate.copy(v.original).add(offset);const previous=v.point.clone();for(let attempt=0;attempt<8;attempt++){v.point.copy(candidate);if(v.faces.every(f=>{const face=faces[f],n=normal(face.ii),a=n.length();return a>Math.max(1e-12,face.area*.45)&&n.dot(face.n)>a*.55;}))return;report.rejectedMoves++;candidate.lerp(previous,.5);}v.point.copy(previous);};
 // Widen the mid/high shoulder around authored ridge axes while retaining its
 // rooted lower body; slightly lower tall crowns into a broad mountain cap.
 for(const v of vertices){if(v.locked)continue;const d=v.domain,delta=new T.Vector3(v.original.x-d.x,0,v.original.z-d.z),length=delta.length();if(length>.01)delta.multiplyScalar(1/length);const shoulder=smooth(v.original.y,8,18)*(1-smooth(v.original.y,34,45)),gain=d.role==='saddle'?.5:2.5;delta.multiplyScalar(gain*shoulder*d.weight);delta.y=-1.6*smooth(v.original.y,30,42)*d.weight;apply(v,v.original.clone().add(delta));}
 for(let pass=0;pass<iterations;pass++){const frozen=vertices.map(v=>v.point.clone());for(let i=0;i<vertices.length;i++){const v=vertices[i];if(v.locked||!v.adj.size)continue;const mean=new T.Vector3();for(const j of v.adj)mean.add(frozen[j]);mean.multiplyScalar(1/v.adj.size);const delta=mean.sub(frozen[i]).multiplyScalar(.25*v.domain.weight);if(v.domain.role==='saddle')delta.y*=.45;apply(v,frozen[i].clone().add(delta));}}
 for(const v of vertices){const delta=v.point.clone().sub(v.original);if(delta.length()<1e-8)continue;if(v.locked){report.protectedByteChanges++;continue;}const local=v.point.clone().applyMatrix4(inverse);report.movedVertices++;report.movedCorners+=v.corners.length;report.domains[v.domain.role]++;report.maxHorizontal=Math.max(report.maxHorizontal,Math.hypot(delta.x,delta.z));report.maxVertical=Math.max(report.maxVertical,Math.abs(delta.y));for(const i of v.corners)p.setXYZ(i,local.x,local.y,local.z);}
 p.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.softCitadelMountain=report;return report;
}
