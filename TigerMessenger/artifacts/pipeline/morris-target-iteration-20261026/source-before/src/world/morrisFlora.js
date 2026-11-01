import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const apply=(g,p,s=[1,1,1],q=new T.Quaternion())=>g.applyMatrix4(new T.Matrix4().compose(V(...p),q,V(...s)));
// Lobed blades rise from a basal rosette and curl back at their tip. Both the
// silhouette and the cupped cross section are geometry, not painted outlines.
function curvedLeaf(){const p=[],c=[],ix=[],dark=new T.Color(0x344d3a),light=new T.Color(0x9b9d61);for(let j=0;j<=22;j++){const t=j/22,w=Math.sin(Math.PI*t)*(.42+.11*Math.sin(t*Math.PI*10));for(let k=0;k<5;k++){const u=k/2-1;p.push(u*w,.035+Math.sin(t*Math.PI)*.48+t*t*.57+Math.abs(u)*.10*Math.sin(t*Math.PI),1.6*t-.65*t**5);const col=dark.clone().lerp(light,.2+t*.42+(1-Math.abs(u))*.2);c.push(col.r,col.g,col.b);if(j<22&&k<4){const n=j*5+k;ix.push(n,n+5,n+1,n+1,n+5,n+6);}}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(ix);g.computeVertexNormals();return g;}
function flowerGeometry(kind=0){const p=[],ix=[],petals=kind===0?7:kind===1?11:8,rings=kind===0?2:1;
 for(let layer=0;layer<rings;layer++)for(let k=0;k<petals;k++){const a=(k+.5*layer)*Math.PI*2/petals,offset=p.length/3;for(let j=0;j<=8;j++){const t=j/8,w=Math.sqrt(Math.max(0,Math.sin(t*Math.PI)))*(.13-layer*.03),r=.035+t*(.31-layer*.09);for(const side of[-1,1])p.push(Math.sin(a)*r+Math.cos(a)*w*side,.59+layer*.045+.09*Math.sin(t*Math.PI)-.045*t*t,Math.cos(a)*r-Math.sin(a)*w*side);}for(let j=0;j<8;j++){const n=offset+j*2;ix.push(n,n+2,n+1,n+1,n+2,n+3);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;}
export function createMorrisFlora({group,heightAt,pathDistance,random,linearScale=1,canPlant=()=>true}){
 const palette=[0xa93632,0xf2dfae,0xc35140,0xe8d3a0,0xc39743],flowerPoints=[],clumps=[],extent=19*linearScale;
 // Bouquets follow two interwoven flow fields. Each cluster has low leaves,
 // medium blooms and some taller stems, so distance views read as verdure.
 for(let gx=-extent;gx<=extent;gx+=2.3)for(let gz=-extent;gz<=extent;gz+=2.3){const x=gx+(random()-.5)*1.2,z=gz+(random()-.5)*1.2;if(Math.hypot(x,z)>extent||!canPlant(x,z)||pathDistance(x,z)<2.25)continue;const band=Math.sin(x*.22+Math.sin(z*.16)*1.9)+Math.cos(z*.27-x*.08);if(random()>.84+.07*band)continue;const yaw=Math.atan2(Math.cos(z*.19),Math.sin(x*.17)),kind=Math.floor(random()*5);clumps.push({x,z,yaw});
  const count=7+Math.floor(random()*5);for(let j=0;j<count;j++){const a=j*2.399+yaw,r=.12+Math.sqrt(j/count)*.95,xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r;if(!canPlant(xx,zz)||pathDistance(xx,zz)<1.65)continue;flowerPoints.push({x:xx,z:zz,y:heightAt(xx,zz),scale:.65+random()*.75,kind:j%4===0?1:kind,yaw:a});}}
 const stemGeo=new T.CylinderGeometry(.014,.022,.58,5);stemGeo.translate(0,.29,0);const leaves=[];for(let j=0;j<4;j++){const a=j*2.4;leaves.push(apply(new T.SphereGeometry(1,7,4),[Math.cos(a)*.10,.12+j*.075,Math.sin(a)*.10],[.18,.025,.075],new T.Quaternion().setFromEuler(new T.Euler(.25,a,.4))));}
 const greenGeo=mergeGeometries([stemGeo,...leaves],false),greenMat=new T.MeshStandardMaterial({color:0x435d3b,roughness:.88}),dummy=new T.Object3D();
 const greens=new T.InstancedMesh(greenGeo,greenMat,flowerPoints.length);greens.name='morris-clustered-bloom-stems-and-lance-leaves';greens.receiveShadow=true;group.add(greens);
 flowerPoints.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();greens.setMatrixAt(i,dummy.matrix);});greens.computeBoundingSphere();
 for(let k=0;k<5;k++){const points=flowerPoints.filter(p=>p.kind===k),petals=new T.InstancedMesh(flowerGeometry(k===0||k===2?0:k===1||k===3?1:2),new T.MeshStandardMaterial({color:palette[k],roughness:.78,side:T.DoubleSide}),points.length),hearts=new T.InstancedMesh(new T.SphereGeometry(.07,7,5),new T.MeshStandardMaterial({color:k===0||k===2?0x55402a:0xc09843,roughness:.8}),points.length);petals.name='morris-cupped-rose-and-ivory-daisy-bouquets';petals.receiveShadow=true;group.add(petals,hearts);points.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();petals.setMatrixAt(i,dummy.matrix);dummy.position.y+=.61*p.scale;dummy.scale.set(p.scale,p.scale*.6,p.scale);dummy.updateMatrix();hearts.setMatrixAt(i,dummy.matrix);});petals.computeBoundingSphere();hearts.computeBoundingSphere();}
 const leafGeo=curvedLeaf(),leafMat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.82}),leafPoints=[];
 const feeding=linearScale>1?[[-24,21.3],[39.3,27.1],[-8.8,37.8]]:[[-6,4],[5,1],[0,-7]];
 for(const c of clumps)if(random()<.93)leafPoints.push([c.x,c.z,c.yaw]);
 for(let i=0;i<200*linearScale**2;i++){const x=(random()-.5)*37*linearScale,z=(random()-.5)*37*linearScale;if(!canPlant(x,z)||Math.hypot(x,z)>extent||pathDistance(x,z)<1.8)continue;leafPoints.push([x,z,random()*6.28]);}
 leafPoints.push(...feeding.map(([x,z])=>[x,z,0]));
 const acanthus=new T.InstancedMesh(leafGeo,leafMat,leafPoints.length*8);acanthus.name='morris-interwoven-lobed-acanthus-rosettes';acanthus.receiveShadow=true;acanthus.castShadow=true;group.add(acanthus);let n=0;
 for(const[x,z,yaw]of leafPoints)for(let j=0;j<8;j++){dummy.position.set(x,heightAt(x,z),z);dummy.rotation.set(0,yaw+j*Math.PI/4+random()*.25,0);const scale=.58+random()*.45;dummy.scale.set(scale,.7+random()*.5,scale);dummy.updateMatrix();acanthus.setMatrixAt(n++,dummy.matrix);}acanthus.computeBoundingSphere();
 return{flowerCount:flowerPoints.length,bouquetClumps:clumps.length,acanthusClumps:leafPoints.length,feeding,revision:'layered-verdure-v1'};
}

/** Sparse climbing roses on solid facade strips; the gate opening stays clear. */
export function dressMorrisFacadeVines(castle){
 const stems=[],leaves=[],blooms=[];
 for(const[i,x,z,h]of[[0,-6.15,2.58,4.8],[1,6.15,1.58,5.6],[2,-2.85,4.72,3.35],[3,2.85,4.72,3.35]]){
  const points=[];for(let j=0;j<=16;j++){const t=j/16;points.push(V(x+Math.sin(t*8+i)*.22,.25+t*h,z+.035*Math.cos(t*5)));}stems.push(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.025,5,false));
  for(let j=0;j<16;j++){const t=.08+j*.054,y=.25+t*h,xx=x+Math.sin(t*8+i)*.22;for(const side of[-1,1])leaves.push({x:xx+side*.07,y,z:z+.03,yaw:side*.7+j*.11,s:.26+(j%3)*.045});if(j%2===0)blooms.push({x:xx+Math.sin(j)*.16,y:y+.16,z:z+.025,s:.45+(j%3)*.055});}
 }
 const sg=mergeGeometries(stems,false);stems.forEach(g=>g.dispose());const wood=new T.Mesh(sg,new T.MeshStandardMaterial({color:0x5e6540,roughness:.93}));wood.name='morris-facade-rose-climbing-stems';castle.add(wood);
 const foliage=new T.InstancedMesh(curvedLeaf(),new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.82}),leaves.length),petals=new T.InstancedMesh(flowerGeometry(0),new T.MeshStandardMaterial({color:0xb04436,side:T.DoubleSide,roughness:.78}),blooms.length),hearts=new T.InstancedMesh(new T.SphereGeometry(.055,6,4),new T.MeshStandardMaterial({color:0xb79549,roughness:.83}),blooms.length),d=new T.Object3D();foliage.name='morris-facade-small-lobed-leaves';petals.name='morris-facade-climbing-red-roses';
 leaves.forEach((p,i)=>{d.position.set(p.x,p.y,p.z);d.rotation.set(-Math.PI/2,0,p.yaw);d.scale.setScalar(p.s);d.updateMatrix();foliage.setMatrixAt(i,d.matrix);});blooms.forEach((p,i)=>{d.position.set(p.x,p.y,p.z);d.rotation.set(Math.PI/2,i*.4,0);d.scale.setScalar(p.s);d.updateMatrix();petals.setMatrixAt(i,d.matrix);d.position.z+=.61*p.s;d.rotation.set(0,0,0);d.updateMatrix();hearts.setMatrixAt(i,d.matrix);});for(const m of[foliage,petals,hearts]){m.computeBoundingSphere();m.receiveShadow=true;castle.add(m);}return{climbingRoseStems:4,facadeRoses:blooms.length,facadeLeafBlades:leaves.length};
}
