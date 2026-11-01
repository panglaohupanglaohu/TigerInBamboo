import * as T from 'three';
/** Keep the existing moon lake and its complete garden in their original frame. */
export function moonLakePreservedRegion(lake){
 lake.group.updateWorldMatrix(true,true);
 return{name:'moon-lake-and-garden',frame:lake.group.matrixWorld.clone().invert(),radius:32};
}
export function createMorrisPreservation(root,regions=[]){
 const point=new T.Vector3(),world=new T.Vector3();root.updateWorldMatrix(true,false);
 const containsWorld=p=>regions.some(r=>{point.copy(p).applyMatrix4(r.frame);return Math.abs(point.y)<80&&Math.hypot(point.x,point.z)<r.radius;});
 const containsLocal=(x,z,y=3)=>containsWorld(world.set(x,y,z).applyMatrix4(root.matrixWorld));
 return{regions,containsWorld,containsLocal};
}
/** Polar mesh leaves a real opening even when the exclusion crosses the outer shore. */
export function morrisWaterGeometry(edge,ratio,preserved,waterY){
 const positions=[],indices=[],rings=128,segments=320,stride=segments+1;
 for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,r=edge(a)*ratio*j/rings;positions.push(Math.cos(a)*r,0,Math.sin(a)*r);}
 const safe=(a,b,c)=>{for(const k of[a,b,c])if(preserved.containsLocal(positions[k*3],positions[k*3+2],waterY))return false;return !preserved.containsLocal((positions[a*3]+positions[b*3]+positions[c*3])/3,(positions[a*3+2]+positions[b*3+2]+positions[c*3+2])/3,waterY);};
 for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=j*stride+i,b=a+stride;for(const face of [[a,b,a+1],[b,b+1,a+1]])if(safe(...face))indices.push(...face);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
