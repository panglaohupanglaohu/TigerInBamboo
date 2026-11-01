import * as T from'three';
import{createCastleOceanSampler}from'./newCityRidgeCandidate.js';

const clamp=T.MathUtils.clamp,smooth=T.MathUtils.smoothstep;
/** Whole-mountain cliff treatment. Construction tops, true sea toes and the
 * actual railway are hard constraints; only exposed mid-wall rock can bow.
 * Shared-edge subdivision supplies actual controllable midpoints on tall
 * remesh walls rather than trying to bend one hundred-metre triangle. */
export function shapeCitadelCliffShoulders(geometry,{toChart=new T.Matrix4(),castleMatrix,railPoints=[],radius=160,maxBow=5.5,maxEdge=9,rounds=4}={}){
 if(!castleMatrix)return{version:'citadel-cliff-shoulders-1',enabled:false,reason:'actual castle frame required'};
 const chartToWorld=castleMatrix,worldToChart=castleMatrix.clone().invert(),worldNormal=new T.Matrix3().getNormalMatrix(castleMatrix),seaAt=createCastleOceanSampler(castleMatrix,radius),inverse=toChart.clone().invert(),source=geometry.index?geometry.toNonIndexed():geometry.clone(),names=Object.keys(source.attributes),originalTriangles=source.attributes.position.count/3;
 const attributes=Object.fromEntries(names.map(name=>[name,{size:source.attributes[name].itemSize,source:source.attributes[name]}])),points=new Map(),cols=new Map(),step=3;
 function point(values){const key=values.join(',');if(!points.has(key)){const chart=new T.Vector3(...values).applyMatrix4(toChart);points.set(key,{values,chart,id:points.size});const k=Math.round(chart.x/step)+','+Math.round(chart.z/step);cols.set(k,Math.max(cols.get(k)??-Infinity,chart.y));}return points.get(key);}
 let triangles=[];for(let i=0;i<source.attributes.position.count;i+=3){const tri=[];for(let j=0;j<3;j++){const attrs={};for(const name of names){const a=attributes[name];attrs[name]=Array.from({length:a.size},(_,k)=>a.source.array[(i+j)*a.size+k]);}tri.push({point:point(attrs.position),attrs});}triangles.push(tri);}
 const topAt=p=>{const x=Math.round(p.x/step),z=Math.round(p.z/step);let top=-Infinity;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)top=Math.max(top,cols.get((x+a)+','+(z+b))??-Infinity);return top;};
 const seaCache=new Map(),sea=p=>{const k=p.x.toFixed(4)+','+p.z.toFixed(4);if(!seaCache.has(k))seaCache.set(k,seaAt(p.x,p.z));return seaCache.get(k);};
 const key=(a,b)=>a.id<b.id?a.id+':'+b.id:b.id+':'+a.id;
 const wall=tri=>{const a=tri.map(v=>v.point.chart),normal=new T.Triangle(...a).getNormal(new T.Vector3()).applyMatrix3(worldNormal).normalize(),center=a[0].clone().add(a[1]).add(a[2]).multiplyScalar(1/3).applyMatrix4(chartToWorld).normalize();return Math.abs(normal.dot(center))<.68;};
 let splits=0;
 for(let round=0;round<rounds;round++){const cut=new Map();for(const tri of triangles){if(!wall(tri))continue;for(let k=0;k<3;k++){const a=tri[k].point,b=tri[(k+1)%3].point;if(a.chart.distanceTo(b.chart)>maxEdge){const center=a.chart.clone().add(b.chart).multiplyScalar(.5),s=sea(center);if(s!==null&&center.y>s+4)cut.set(key(a,b),point(a.values.map((v,i)=>Math.fround((v+b.values[i])*.5))));}}}if(!cut.size)break;
  const next=[],mid=(a,b)=>{const p=cut.get(key(a.point,b.point));if(!p)return null;const attrs={};for(const name of names)attrs[name]=name==='position'?p.values:a.attrs[name].map((v,i)=>(v+b.attrs[name][i])*.5);return{point:p,attrs};};
  for(const tri of triangles){let [a,b,c]=tri,m=mid(a,b),n=mid(b,c),o=mid(c,a),count=+!!m+!!n+!!o;if(!count){next.push(tri);continue;}if(count===1){if(n){[a,b,c]=[b,c,a];m=n;}else if(o){[a,b,c]=[c,a,b];m=o;}next.push([a,m,c],[m,b,c]);}else if(count===2){if(!m){[a,b,c]=[b,c,a];m=n;n=o;}else if(!n){[a,b,c]=[c,a,b];n=m;m=o;}next.push([b,n,m],[a,m,c],[m,n,c]);}else next.push([a,m,o],[m,b,n],[o,n,c],[m,n,o]);splits++;}triangles=next;
 }
 const vertexData=new Map();for(const p of points.values())vertexData.set(p.id,{point:p,original:p.chart.clone(),next:p.chart.clone(),normal:new T.Vector3(),faces:[],flat:false});
 const faces=[];for(const tri of triangles){const a=tri.map(v=>v.point.chart),n=a[1].clone().sub(a[0]).cross(a[2].clone().sub(a[0])),area=n.length(),unit=n.clone().normalize(),worldN=unit.clone().applyMatrix3(worldNormal).normalize(),up=a[0].clone().add(a[1]).add(a[2]).multiplyScalar(1/3).applyMatrix4(chartToWorld).normalize(),flat=Math.abs(worldN.dot(up))>=.68,id=faces.length;faces.push({ids:tri.map(v=>v.point.id),normal:unit,area});for(const v of tri){const d=vertexData.get(v.point.id);d.normal.addScaledVector(unit,area);d.faces.push(id);if(flat)d.flat=true;}}
 const rail=railPoints.map(p=>p.isVector3?p:new T.Vector3().fromArray(p)),report={version:'citadel-cliff-shoulders-1',enabled:true,originalTriangles,triangles:triangles.length,subdivisionSplits:splits,maxEdge,rounds,movedVertices:0,protectedCapVertices:0,protectedRailVertices:0,protectedToeVertices:0,maxMove:0,rejected:0,actualSea:true,railSamples:rail.length};
 for(const d of vertexData.values()){if(!d.faces.length)continue;const p=d.original,s=sea(p),top=topAt(p),above=p.y-s,depth=top-p.y;if(s===null||above<4){report.protectedToeVertices++;continue;}if(d.flat||depth<2.2){report.protectedCapVertices++;continue;}
  const world=p.clone().applyMatrix4(chartToWorld);let railD=Infinity;for(const r of rail)railD=Math.min(railD,world.distanceToSquared(r));railD=Math.sqrt(railD);if(railD<12){report.protectedRailVertices++;continue;}
  const total=Math.max(1,top-s),t=clamp(above/total,0,1),amplitude=maxBow*Math.pow(Math.sin(Math.PI*t),2)*smooth(above,4,11)*smooth(depth,2.2,9)*smooth(total,12,40)*smooth(railD,12,22),normal=d.normal.clone().normalize().applyMatrix3(worldNormal).normalize(),up=world.clone().normalize();normal.addScaledVector(up,-normal.dot(up)).normalize();const delta=normal.multiplyScalar(amplitude).transformDirection(worldToChart).multiplyScalar(amplitude),candidate=p.clone().add(delta);
  // transformDirection normalizes; reapply the intended metre displacement.
  d.next.copy(candidate);
 }
 const faceNormal=f=>{const p=f.ids.map(id=>vertexData.get(id).next);return p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));};
 // Simultaneous validation and local backoff; a safe old face cannot become a
 // reversed or collapsed face merely because two neighbors moved together.
 for(let pass=0;pass<9;pass++){const rejected=new Set();for(const f of faces){const n=faceNormal(f),a=n.length();if(a<Math.max(1e-12,f.area*.4)||n.dot(f.normal)<a*.5)for(const id of f.ids)rejected.add(id);}if(!rejected.size)break;report.rejected+=rejected.size;for(const id of rejected){const d=vertexData.get(id);d.next.lerp(d.original,.5);}}
 for(const d of vertexData.values()){const move=d.next.distanceTo(d.original);if(move>1e-7){report.movedVertices++;report.maxMove=Math.max(report.maxMove,move);}d.local=move<1e-7?new T.Vector3(...d.point.values):d.next.clone().applyMatrix4(inverse);}
 const out=Object.fromEntries(names.map(n=>[n,[]]));for(const tri of triangles)for(const v of tri){const d=vertexData.get(v.point.id);for(const name of names)out[name].push(...(name==='position'?d.local.toArray():v.attrs[name]));}
 geometry.setIndex(null);geometry.clearGroups();for(const name of names)geometry.setAttribute(name,new T.Float32BufferAttribute(out[name],attributes[name].size));geometry.computeBoundingBox();geometry.computeBoundingSphere();source.dispose();geometry.userData.citadelCliffShoulders=report;return report;
}
