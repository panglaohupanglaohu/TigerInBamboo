import * as T from 'three';
import {worldToFlatXZ} from './hills.js';

// The city-facing moon-forest coast meets the south/east edges of the FINAL
// hills rectangle, not the obsolete HARBOR coordinates. Other coasts are untouched.
export const MOON_COAST_WINDOWS=Object.freeze([
 Object.freeze({id:'east',axis:'x',front:66,lo:0,hi:53,fade:3}),
 Object.freeze({id:'south',axis:'z',front:50,lo:20,hi:72,fade:3})
]);
export function moonCoastSections(exclusions=[],lo=20,hi=72){
 let sections=[[lo,hi]];
 for(const [a,b]of exclusions)sections=sections.flatMap(([x,y])=>b<=x||a>=y?[[x,y]]:[[x,Math.max(x,a)],[Math.min(y,b),y]].filter(([u,v])=>v-u>6));
 return sections;
}
export function moonCoastOwns(x,z,patches){
 return patches.some(p=>p.sections.some(([lo,hi])=>{const along=p.axis==='x'?z:x,across=p.axis==='x'?x:z;if(along<=lo||along>=hi)return false;const u=Math.min(1,(along-lo)/3,(hi-along)/3),s=u*u*(3-2*u);return across>p.front+12*(1-s);}));
}

/** Transfer ONLY unprotected city-facing legacy shell remnants to already present
 * final hill/skirt meshes. Ground and rendering use exactly the same finite mask.
 * No old square shell may remain an invisible walking surface in the cleared sea.
 */
export function installMoonCoastOwnership({platforms=[],hills,trackCurves=[],colliders=[],R=160}={}){
 if(hills?.moonCoastOwnership)return hills.moonCoastOwnership;
 if(!hills?.mesh||!hills?.skirt||!platforms.length)return null;
 const protectedSites=[],protect=(position,radius)=>{if(Math.abs(position.length()-(R+.6))>3)return;const f=worldToFlatXZ(position,R);if(!f)return;protectedSites.push({x:f.x,z:f.z,r:radius});};
 for(const curve of trackCurves.filter(Boolean))for(const p of curve.getSpacedPoints(1000))protect(p,2.6);
 for(const c of colliders)if(c?.position)protect(c.position,Math.max(1.3,(c.radius??.6)+.7));
 const patches=MOON_COAST_WINDOWS.map(w=>{const exclusions=protectedSites.filter(p=>{const a=w.axis==='x'?p.x:p.z,b=w.axis==='x'?p.z:p.x;return a+p.r>w.front-2.5&&a-p.r<90&&b+p.r>w.lo&&b-p.r<w.hi;}).map(p=>{const b=w.axis==='x'?p.z:p.x;return[b-p.r,b+p.r];});return{...w,sections:moonCoastSections(exclusions,w.lo,w.hi),protectedIntervals:exclusions.length};});
 const report={revision:'moon-coast-r3-20261025',patches,renderOwners:['final-hills-mesh','hills-closed-skirt'],raySamples:0,rayMisses:0,triangleQueries:0,terrainEdited:false,globalSeaEdited:false};
 if(!patches.some(p=>p.sections.length)){report.status='no-safe-sector';return hills.moonCoastOwnership=report;}
 const direction=new T.Vector3(),origin=new T.Vector3(),ray=new T.Ray(),ground=[hills.mesh,hills.skirt],cache=new Map(),bins=new Map();ground.forEach(m=>m.updateWorldMatrix(true,false));
 // Build a local angular triangle index ONCE; player queries never raycast the
 // entire island. Bin every triangle by its true flat bounds, including skirt.
 const step=3,triangles=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(const mesh of ground){const g=mesh.geometry,p=g.attributes.position,ix=g.index;for(let k=0;k<(ix?.count??p.count);k+=3){const ids=[0,1,2].map(j=>ix?ix.getX(k+j):k+j),vertices=ids.map(i=>new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld)),flat=vertices.map(v=>worldToFlatXZ(v,R));if(flat.some(f=>!f))continue;const minX=Math.min(...flat.map(f=>f.x)),maxX=Math.max(...flat.map(f=>f.x)),minZ=Math.min(...flat.map(f=>f.z)),maxZ=Math.max(...flat.map(f=>f.z));if(maxX<17||maxZ< -3)continue;const n=triangles.push(vertices)-1;for(let x=Math.floor((minX-.1)/step);x<=Math.floor((maxX+.1)/step);x++)for(let z=Math.floor((minZ-.1)/step);z<=Math.floor((maxZ+.1)/step);z++){const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(n);}}}
 const sample=position=>{report.raySamples++;direction.copy(position).normalize();const f=worldToFlatXZ(position,R),key=f.x.toFixed(4)+','+f.z.toFixed(4);if(cache.has(key))return cache.get(key);origin.copy(direction).multiplyScalar(R+20);ray.set(origin,direction.clone().negate());let radius=-Infinity;const hit=new T.Vector3();for(const i of bins.get(Math.floor(f.x/step)+','+Math.floor(f.z/step))??[]){report.triangleQueries++;const t=triangles[i];a.copy(t[0]);b.copy(t[1]);c.copy(t[2]);if(ray.intersectTriangle(a,b,c,false,hit))radius=Math.max(radius,hit.length());}if(radius===-Infinity)report.rayMisses++;if(cache.size>4096)cache.clear();cache.set(key,radius);return radius;};
 const owns=position=>{const f=worldToFlatXZ(position,R);return f&&moonCoastOwns(f.x,f.z,patches);};
 const oldSample=hills.sampleRadius;hills.sampleRadius=position=>owns(position)?sample(position):oldSample?.(position);
 const rows=[];
 for(const p of platforms){if(!p.mesh?.userData?.authoredMainIslandShell)continue;
  const prior=p.topHeightAt.bind(p);p.topHeightAt=position=>owns(position)?sample(position):prior(position);
  const original=p.mesh.material,material=original.clone(),compile=original.onBeforeCompile;
  material.onBeforeCompile=shader=>{compile.call(original,shader);const masks=patches.flatMap(p=>p.sections.map(([lo,hi])=>{const along=p.axis==='x'?'gxz.y':'gxz.x',across=p.axis==='x'?'gxz.x':'gxz.y';return`if(${along}>${lo.toFixed(6)}&&${along}<${hi.toFixed(6)}){float mu=min(1.0,min((${along}-${lo.toFixed(6)})/3.0,(${hi.toFixed(6)}-${along})/3.0));float ms=mu*mu*(3.0-2.0*mu);if(${across}>${p.front.toFixed(6)}+12.0*(1.0-ms))discard;}`;})).join('\n');
   // Existing main-shell shader declares gxz in this exact scope.
   shader.fragmentShader=shader.fragmentShader.replace('if(gd.y>.64',`${masks}\n if(gd.y>.64`);
  };
  material.customProgramCacheKey=()=>`moon-coast-r3:${JSON.stringify(patches)}`;material.userData.shared=false;p.mesh.material=material;p.mat=material;material.needsUpdate=true;rows.push(p.mesh.uuid);
 }
 report.shells=rows;report.indexedTriangles=triangles.length;report.status=rows.length?'installed':'main-shell-not-found';return hills.moonCoastOwnership=report;
}
