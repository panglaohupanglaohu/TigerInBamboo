import * as T from 'three';
/** Reduce proposed shared-point displacement until no source face reverses or collapses. */
export function guardMountainDisplacement(sourcePosition,targetPosition,index=null){
 const ids=new Int32Array(sourcePosition.count),map=new Map(),nodes=[],faces=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(let i=0;i<ids.length;i++){a.fromBufferAttribute(sourcePosition,i);const key=a.toArray().join(',');let id=map.get(key);if(id===undefined){id=nodes.length;map.set(key,id);const base=a.clone(),target=new T.Vector3().fromBufferAttribute(targetPosition,i);nodes.push({base,delta:target.sub(base),w:1});}ids[i]=id;}
 for(let f=0;f<(index?.count??ids.length);f+=3){const n=[0,1,2].map(k=>ids[index?index.getX(f+k):f+k]),v=n.map(i=>nodes[i].base),normal=new T.Vector3().crossVectors(v[1].clone().sub(v[0]),v[2].clone().sub(v[0]));if(normal.lengthSq()>1e-14)faces.push({n,normal,area2:normal.lengthSq()});}
 const quant=v=>v.set(Math.fround(v.x),Math.fround(v.y),Math.fround(v.z));
 const bad=face=>{const v=face.n.map(i=>nodes[i]);quant(a.copy(v[0].base).addScaledVector(v[0].delta,v[0].w));quant(b.copy(v[1].base).addScaledVector(v[1].delta,v[1].w));quant(c.copy(v[2].base).addScaledVector(v[2].delta,v[2].w));b.sub(a).cross(c.sub(a));return b.dot(face.normal)<face.area2*.002||b.lengthSq()<Math.min(face.area2,Math.max(1.01e-12,face.area2*.0004));};
 let rounds=0,constrained=0;for(;rounds<80;rounds++){const flagged=new Set();for(const f of faces)if(bad(f))for(const i of f.n)if(nodes[i].delta.lengthSq()>1e-12)flagged.add(i);if(!flagged.size)break;constrained+=flagged.size;for(const i of flagged)nodes[i].w=rounds<24?nodes[i].w*.5:0;}
 let failures=faces.filter(bad).length;if(failures){for(const node of nodes)node.w=0;failures=0;}
 let moved=0,maxMove=0;for(let i=0;i<ids.length;i++){const n=nodes[ids[i]];a.copy(n.base).addScaledVector(n.delta,n.w);targetPosition.setXYZ(i,a.x,a.y,a.z);const d=n.delta.length()*n.w;if(d>1e-5)moved++;maxMove=Math.max(maxMove,d);}
 targetPosition.needsUpdate=true;return{rounds,constrainedAssignments:constrained,remainingInvalid:failures,movedCorners:moved,maxDisplacement:maxMove,rule:'shared source-point weights; positive source-facing area and >=2% original area'};
}
