import * as T from 'three';
import {styleMat} from '../style/materials.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
// Flower sea removed: bouquets and bloom stems are not generated. Leaf rosettes remain.
const SHOW_FLOWER_SEA=false;
const apply=(g,p,s=[1,1,1],q=new T.Quaternion())=>g.applyMatrix4(new T.Matrix4().compose(V(...p),q,V(...s)));
// Lobed blades rise from a basal rosette and curl back at their tip. Both the
// silhouette and the cupped cross section are geometry, not painted outlines.
/** Close an indexed petal/leaf surface without adding per-instance objects. */
export function solidifySurface(surface,thickness=.02){const a=surface.attributes.position,front=Array.from(a.array),n=a.count,p=[...front,...front],ix=[],edges=new Map(),src=surface.index.array;for(let j=0;j<n;j++)p[(j+n)*3+1]-=thickness;for(let j=0;j<src.length;j+=3){const[a,b,c]=[src[j],src[j+1],src[j+2]];ix.push(a,b,c,c+n,b+n,a+n);for(const[u,v]of[[a,b],[b,c],[c,a]]){const key=Math.min(u,v)+','+Math.max(u,v);if(edges.has(key))edges.delete(key);else edges.set(key,[u,v]);}}for(const[u,v]of edges.values())ix.push(v,u,u+n,v,u+n,v+n);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);if(surface.attributes.color){const c=surface.attributes.color.array,colors=Array.from(c);for(let j=0;j<c.length;j++)colors.push(c[j]*.83);g.setAttribute('color',new T.Float32BufferAttribute(colors,3));}g.computeVertexNormals();g.userData={...surface.userData,solidThickness:thickness,closed:true};surface.dispose();return g;}
function curvedLeaf(){const p=[],c=[],ix=[],dark=new T.Color(0x344d3a),light=new T.Color(0x9b9d61);for(let j=0;j<=8;j++){const t=j/8,profile=Math.pow(Math.max(0,Math.sin(Math.PI*t)),.78),w=.008+.50*profile*(.73+.27*Math.cos(t*Math.PI*6));for(let k=0;k<3;k++){const u=k-1,asym=1+.10*Math.sin(t*Math.PI*4)*u;p.push(u*w*asym,.035+Math.sin(t*Math.PI)*.50+t*t*.48+u*u*.12*Math.sin(t*Math.PI)+.035*Math.exp(-u*u*9)*profile,1.55*t-.45*t**4-.25*t**10);const col=dark.clone().lerp(light,.18+t*.25+(1-Math.abs(u))*.24);c.push(col.r,col.g,col.b);if(j<8&&k<2){const n=j*3+k;ix.push(n,n+3,n+1,n+1,n+3,n+4);}}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(ix);return solidifySurface(g,.024);}

function flowerGeometry(kind=0){const p=[],ix=[],petals=kind===0?7:kind===1?11:8,rings=kind===0?2:1;
 for(let layer=0;layer<rings;layer++)for(let k=0;k<petals;k++){const a=(k+.5*layer)*Math.PI*2/petals,offset=p.length/3;for(let j=0;j<=2;j++){const t=j/2,w=Math.sqrt(Math.max(0,Math.sin(t*Math.PI)))*(.13-layer*.03),r=.035+t*(.31-layer*.09);for(const side of[-1,1])p.push(Math.sin(a)*r+Math.cos(a)*w*side,.59+layer*.045+(kind===0?.10:.055)*Math.sin(t*Math.PI)+(kind===0?.10:-.035)*t*t,Math.cos(a)*r-Math.sin(a)*w*side);}for(let j=0;j<2;j++){const n=offset+j*2;ix.push(n,n+2,n+1,n+1,n+2,n+3);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);return solidifySurface(g,.008);}
/** Split an instanced set into spatial cells so three.js can frustum-cull each cell separately. */
function chunkInstances(group,name,geo,mat,entries,cell=40,opts={}){const buckets=new Map();for(const e of entries){const key=Math.floor(e.x/cell)+','+Math.floor(e.z/cell);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(e);}const meshes=[];for(const list of buckets.values()){const m=new T.InstancedMesh(geo,mat,list.length);m.name=name;m.receiveShadow=true;m.castShadow=!!opts.cast;list.forEach((e,i)=>m.setMatrixAt(i,e.matrix));m.computeBoundingSphere();group.add(m);meshes.push(m);}return meshes;}
// Grass as flat painted rosettes: one textured quad per clump instead of a curled blade mesh.
// The shadow pool and the lobed outline are drawn with polar curves on a canvas, so the
// outline is authored once and reused by every instance (no per-instance triangles).
let rosetteTex=null;
const rosetteTexCache=new Map();
function rosetteTexture(variant=0){
 if(rosetteTexCache.has(variant))return rosetteTexCache.get(variant);
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
 let seed=9137+variant*7919;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 // Morris tapestry verdure: dark acanthus blades with pale veins, then
 // red / ivory / gold blooms woven over them (target image 4).
 const blade=(x,y,angle,scale,shade,vein)=>{
  g.save();g.translate(x,y);g.rotate(angle);g.scale(scale,scale);
  const center=t=>({x:30*Math.sin(t*Math.PI*1.3),y:-170*t});
  const side=(t,sign)=>{const p=center(t),w=58*Math.pow(Math.sin(Math.PI*t),.7)*(.66+.34*Math.cos(t*Math.PI*11));return{x:p.x+sign*w,y:p.y+sign*7*Math.sin(t*Math.PI*2)};};
  g.beginPath();g.moveTo(0,0);for(let j=1;j<=64;j++){const p=side(j/64,1);g.lineTo(p.x,p.y);}for(let j=63;j>=0;j--){const p=side(j/64,-1);g.lineTo(p.x,p.y);}g.closePath();g.fillStyle=shade;g.fill();g.strokeStyle='#1d2f22';g.lineWidth=3;g.stroke();
  g.beginPath();g.moveTo(0,0);for(let j=1;j<=28;j++){const p=center(j/28);g.lineTo(p.x,p.y);}g.strokeStyle=vein;g.lineWidth=3;g.stroke();
  for(let j=1;j<=5;j++)for(const sign of[-1,1]){const t=j/6,p=center(t-.05),q=side(t,sign);g.beginPath();g.moveTo(p.x,p.y);g.quadraticCurveTo(q.x*.6,p.y-10,q.x*.9,q.y);g.lineWidth=1.5;g.stroke();}
  g.restore();
 };
 const greens=[['#2c4630','#8f9a62'],['#3d5a36','#b3b07a'],['#56703f','#c9c08a'],['#6f8346','#d7cd94'],['#24402f','#7f9a6a']];
 for(let k=0;k<9;k++){const a=k/9*Math.PI*2+rnd()*.5,r=40+rnd()*60,[f,v]=greens[(k+variant)%greens.length];blade(256+Math.cos(a)*r*.5,256+Math.sin(a)*r*.5,a+Math.PI/2+(rnd()-.5)*.6,.8+rnd()*.5,f,v);}
 const flower=(x,y,r,petal,edge,heart,n=6)=>{g.save();g.translate(x,y);g.rotate(rnd()*6);for(let k=0;k<n;k++){g.save();g.rotate(k*Math.PI*2/n);g.beginPath();g.moveTo(0,0);g.bezierCurveTo(-r*.55,-r*.35,-r*.45,-r*1.05,0,-r);g.bezierCurveTo(r*.45,-r*1.05,r*.55,-r*.35,0,0);g.fillStyle=petal;g.fill();g.strokeStyle=edge;g.lineWidth=2;g.stroke();g.restore();}g.fillStyle=heart;g.beginPath();g.arc(0,0,r*.28,0,Math.PI*2);g.fill();g.restore();};
 const red=['#b8322a','#7a1c1a','#e2b04a'],ivory=['#f1e8d0','#8f8a6c','#d9a531'],gold=['#e0ad35','#8c6420','#a8461f'],coral=['#cf4a35','#86241c','#f0d9a0'];
 const mixes=[[red,red,ivory,gold],[ivory,ivory,red,gold],[gold,red,ivory,coral],[red,coral,ivory,red]][variant%4];
 const count=[7,8,7,8][variant%4];
 for(let k=0;k<count;k++){const a=rnd()*Math.PI*2,r=rnd()*165,[pc,ec,hc]=mixes[k%mixes.length];flower(256+Math.cos(a)*r,256+Math.sin(a)*r,22+rnd()*20,pc,ec,hc,pc===ivory[0]?10:6);}
 for(let k=0;k<10;k++){const a=rnd()*Math.PI*2,r=rnd()*180;g.fillStyle=k%3?'#a8302a':'#e9d9a8';g.beginPath();g.arc(256+Math.cos(a)*r,256+Math.sin(a)*r,4+rnd()*4,0,Math.PI*2);g.fill();}
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;rosetteTexCache.set(variant,tex);return tex;
}
function rosetteGeometry(){const d=new T.PlaneGeometry(2.5,2.5);d.rotateX(-Math.PI/2);d.translate(0,.03,0);return d;}
function rosetteMaterial(variant=0){return styleMat('morris.flora.rosette','MeshStandardMaterial',{map:rosetteTexture(variant),alphaTest:.12,transparent:false,side:T.DoubleSide,roughness:.9});}
export function createMorrisFlora({group,heightAt,pathDistance,random,linearScale=1,canPlant=()=>true}){
 const palette=[0xa93632,0xf2dfae,0xc35140,0xe8d3a0,0xc39743],flowerPoints=[],clumps=[],extent=19*linearScale;
 // Bouquets follow two interwoven flow fields. Each cluster has low leaves,
 // medium blooms and some taller stems, so distance views read as verdure.
 for(let gx=-extent;gx<=extent;gx+=3.2)for(let gz=-extent;gz<=extent;gz+=3.2){const x=gx+(random()-.5)*1.2,z=gz+(random()-.5)*1.2;if(Math.hypot(x,z)>extent||!canPlant(x,z)||pathDistance(x,z)<2.25)continue;const band=Math.sin(x*.22+Math.sin(z*.16)*1.9)+Math.cos(z*.27-x*.08);if(random()>.84+.07*band)continue;const yaw=Math.atan2(Math.cos(z*.19),Math.sin(x*.17)),kind=Math.floor(random()*5);clumps.push({x,z,yaw});
  const count=4+Math.floor(random()*3);for(let j=0;j<count;j++){const a=j*2.399+yaw,r=.12+Math.sqrt(j/count)*.95,xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r;if(!canPlant(xx,zz)||pathDistance(xx,zz)<1.65)continue;flowerPoints.push({x:xx,z:zz,y:heightAt(xx,zz),scale:.85+random()*.60,kind:j%4===0?1:kind,yaw:a});}}
 const stemGeo=new T.CylinderGeometry(.014,.022,.58,5);stemGeo.translate(0,.29,0);const leaves=[];for(let j=0;j<4;j++){const a=j*2.4;leaves.push(apply(new T.SphereGeometry(1,5,3),[Math.cos(a)*.10,.12+j*.075,Math.sin(a)*.10],[.18,.025,.075],new T.Quaternion().setFromEuler(new T.Euler(.25,a,.4))));}
 if(!SHOW_FLOWER_SEA)flowerPoints.length=0;
 const greenGeo=mergeGeometries([stemGeo,...leaves],false),greenMat=styleMat('morris.flora.green','MeshStandardMaterial',{color:0x435d3b,roughness:.88}),dummy=new T.Object3D();
 const greens=new T.InstancedMesh(greenGeo,greenMat,flowerPoints.length);greens.name='morris-clustered-bloom-stems-and-lance-leaves';greens.receiveShadow=true;group.add(greens);
 flowerPoints.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();greens.setMatrixAt(i,dummy.matrix);});greens.computeBoundingSphere();
 for(let k=0;k<5;k++){const points=flowerPoints.filter(p=>p.kind===k),petalEntries=[],heartEntries=[];points.forEach((p)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();petalEntries.push({matrix:dummy.matrix.clone(),x:p.x,z:p.z});dummy.position.y+=.61*p.scale;dummy.scale.set(p.scale,p.scale*.6,p.scale);dummy.updateMatrix();heartEntries.push({matrix:dummy.matrix.clone(),x:p.x,z:p.z});});chunkInstances(group,'morris-cupped-rose-and-ivory-daisy-bouquets',flowerGeometry(k===0||k===2?0:k===1||k===3?1:2),styleMat('morris.flora.bouquet','MeshStandardMaterial',{color:palette[k],roughness:.78,side:T.DoubleSide}),petalEntries,40);chunkInstances(group,'morris-bouquet-heart-buds',new T.SphereGeometry(.07,4,3),styleMat('morris.flora.bouquet-heart-buds','MeshStandardMaterial',{color:k===0||k===2?0x55402a:0xc09843,roughness:.8}),heartEntries,40);}
 const leafGeo=rosetteGeometry(),leafPoints=[];
 const feeding=linearScale>1?[[-24,21.3],[39.3,27.1],[-8.8,37.8]]:[[-6,4],[5,1],[0,-7]];
 // Tapestry verdure carpet: a dense jittered lattice of painted motif cards.
 for(let gx=-extent;gx<=extent;gx+=1.55)for(let gz=-extent;gz<=extent;gz+=1.55){const x=gx+(random()-.5)*1.3,z=gz+(random()-.5)*1.3;if(Math.hypot(x,z)>extent||!canPlant(x,z)||pathDistance(x,z)<1.9)continue;leafPoints.push([x,z,random()*6.28]);}
 leafPoints.push(...feeding.map(([x,z])=>[x,z,0]));
 const variants=[[],[],[],[]];
 for(const[x,z,yaw]of leafPoints){dummy.position.set(x,heightAt(x,z)+.02,z);const gx=(heightAt(x+.25,z)-heightAt(x-.25,z))/.5,gz=(heightAt(x,z+.25)-heightAt(x,z-.25))/.5;dummy.quaternion.setFromUnitVectors(V(0,1,0),V(-gx,1,-gz).normalize()).multiply(new T.Quaternion().setFromAxisAngle(V(0,1,0),yaw));const scale=.85+random()*.45;dummy.scale.set(scale,1,scale);dummy.updateMatrix();variants[Math.floor(random()*4)].push({matrix:dummy.matrix.clone(),x,z});}
 variants.forEach((entries,k)=>{const m=new T.InstancedMesh(leafGeo,rosetteMaterial(k),entries.length);m.name='morris-tapestry-verdure-cards-'+k;m.receiveShadow=true;entries.forEach((e,i)=>m.setMatrixAt(i,e.matrix));m.computeBoundingSphere();group.add(m);});
 // Raised blooms: one instanced head mesh (per-instance colour) + one stem mesh.
 const starPts=[];for(let k=0;k<10;k++){const a=k/10*Math.PI*2,r=k%2?.055:.15;starPts.push(new T.Vector2(Math.cos(a)*r,Math.sin(a)*r));}const headGeo=new T.ShapeGeometry(new T.Shape(starPts),1);headGeo.rotateX(-Math.PI/2+.3);const stemG=new T.PlaneGeometry(.03,1);stemG.translate(0,.5,0);
 const bloomPts=[];for(const[x,z]of leafPoints){const n=random()<.5?1:2;for(let j=0;j<n;j++){const xx=x+(random()-.5)*1.6,zz=z+(random()-.5)*1.6;if(!canPlant(xx,zz)||pathDistance(xx,zz)<1.7)continue;bloomPts.push([xx,zz,.22+random()*.4]);}}
 const bloomColors=[0xb8322a,0xb8322a,0xcf4a35,0xf1e8d0,0xf1e8d0,0xe0ad35,0xd8b54a];
 const heads=new T.InstancedMesh(headGeo,styleMat('morris.flora.heads','MeshStandardMaterial',{roughness:.75,side:T.DoubleSide}),bloomPts.length),stems=new T.InstancedMesh(stemG,styleMat('morris.flora.stems','MeshStandardMaterial',{color:0x3b5a33,roughness:.9,side:T.DoubleSide}),bloomPts.length),bc=new T.Color();
 heads.name='morris-tapestry-raised-blooms';stems.name='morris-tapestry-bloom-stems';
 bloomPts.forEach(([x,z,h],i)=>{const y=heightAt(x,z);dummy.quaternion.identity();dummy.rotation.set(0,random()*6.28,0);dummy.position.set(x,y,z);dummy.scale.set(1,h,1);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);dummy.position.set(x,y+h,z);const s=.8+random()*.6;dummy.scale.set(s,s,s);dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);heads.setColorAt(i,bc.set(bloomColors[Math.floor(random()*bloomColors.length)]));});
 heads.computeBoundingSphere();stems.computeBoundingSphere();group.add(heads,stems);
 const acanthusEntries=variants.flat();
 return{flowerCount:flowerPoints.length,bouquetClumps:clumps.length,acanthusClumps:leafPoints.length,feeding,revision:'tapestry-verdure-r5-20261030',raisedBlooms:bloomPts.length,leafCardsPerClump:1,previousLeafCardsPerClump:6,textureSize:512,leafSolidThickness:0,petalSolidThickness:.008};
}

/** Sparse climbing roses on solid facade strips; the gate opening stays clear. */
export function dressMorrisFacadeVines(castle){
 const stems=[],leaves=[],blooms=[];
 for(const[i,x,z,h]of[[0,-6.15,2.58,4.8],[1,6.15,1.58,5.6],[2,-2.85,4.72,3.35],[3,2.85,4.72,3.35]]){
  const points=[];for(let j=0;j<=16;j++){const t=j/16;points.push(V(x+Math.sin(t*8+i)*.22,.25+t*h,z+.035*Math.cos(t*5)));}stems.push(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.025,5,false));
  for(let j=0;j<16;j++){const t=.08+j*.054,y=.25+t*h,xx=x+Math.sin(t*8+i)*.22;for(const side of[-1,1])leaves.push({x:xx+side*.07,y,z:z+.03,yaw:side*.7+j*.11,s:.26+(j%3)*.045});if(j%2===0)blooms.push({x:xx+Math.sin(j)*.16,y:y+.16,z:z+.025,s:.45+(j%3)*.055});}
 }
 const sg=mergeGeometries(stems,false);stems.forEach(g=>g.dispose());const wood=new T.Mesh(sg,styleMat('morris.flora.wood','MeshStandardMaterial',{color:0x5e6540,roughness:.93}));wood.name='morris-facade-rose-climbing-stems';castle.add(wood);
 const foliage=new T.InstancedMesh(curvedLeaf(),styleMat('morris.flora.facade-rose-climbing-stems','MeshStandardMaterial',{vertexColors:true,side:T.DoubleSide,roughness:.82}),leaves.length),petals=new T.InstancedMesh(flowerGeometry(0),styleMat('morris.flora.petals','MeshStandardMaterial',{color:0xb04436,side:T.DoubleSide,roughness:.78}),blooms.length),hearts=new T.InstancedMesh(new T.SphereGeometry(.055,6,4),styleMat('morris.flora.hearts','MeshStandardMaterial',{color:0xb79549,roughness:.83}),blooms.length),d=new T.Object3D();foliage.name='morris-facade-small-lobed-leaves';petals.name='morris-facade-climbing-red-roses';
 leaves.forEach((p,i)=>{d.position.set(p.x,p.y,p.z);d.rotation.set(-Math.PI/2,0,p.yaw);d.scale.setScalar(p.s);d.updateMatrix();foliage.setMatrixAt(i,d.matrix);});blooms.forEach((p,i)=>{d.position.set(p.x,p.y,p.z);d.rotation.set(Math.PI/2,i*.4,0);d.scale.setScalar(p.s);d.updateMatrix();petals.setMatrixAt(i,d.matrix);d.position.z+=.61*p.s;d.rotation.set(0,0,0);d.updateMatrix();hearts.setMatrixAt(i,d.matrix);});for(const m of[foliage,petals,hearts]){m.computeBoundingSphere();m.receiveShadow=true;castle.add(m);}return{climbingRoseStems:4,facadeRoses:blooms.length,facadeLeafBlades:leaves.length};
}

// Plane-tree understory: 30 red-bloom rosettes per tree in three tiers (10 lying at the root,
// 10 standing at mid height, 10 standing higher). Placed after the botany pass so tree positions are known.
let understoryTex=null;
function understoryTexture(){if(understoryTex)return understoryTex;const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
 g.fillStyle='rgba(22,34,22,0.28)';g.beginPath();g.ellipse(132,136,110,102,0,0,Math.PI*2);g.fill();
 for(let k=0;k<6;k++){g.save();g.translate(128,128);g.rotate(k/6*Math.PI*2+.3);g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(54,-30,96,-6);g.quadraticCurveTo(64,22,0,0);g.closePath();g.fillStyle='#4f6a45';g.fill();g.strokeStyle='#2c3f2e';g.lineWidth=2.5;g.stroke();g.restore();}
 g.save();g.translate(128,128);for(let k=0;k<11;k++){g.save();g.rotate(k*Math.PI*2/11);g.beginPath();g.moveTo(-4,0);g.bezierCurveTo(-30,-26,-20,-70,0,-78);g.bezierCurveTo(20,-70,30,-26,4,0);g.closePath();g.fillStyle='#b3262e';g.fill();g.strokeStyle='#6e1620';g.lineWidth=1.8;g.stroke();g.restore();}
 g.beginPath();g.arc(0,0,15,0,Math.PI*2);g.fillStyle='#e6c76a';g.fill();g.restore();
 understoryTex=new T.CanvasTexture(c);understoryTex.colorSpace=T.SRGBColorSpace;return understoryTex;}
function understoryMaterial(){return styleMat('morris.flora.understory','MeshStandardMaterial',{map:understoryTexture(),alphaTest:.12,side:T.DoubleSide,roughness:.9});}
function standingGeometry(){const d=new T.PlaneGeometry(1.4,1.4);d.translate(0,.7,0);return d;}
export function addPlaneTreeUnderstory({group,trees,heightAt,random}){
 const tiers=[{key:'lower',lift:0,stand:false,r:[2.4,3.8]},{key:'middle',lift:0,stand:true,r:[2.2,3.4]},{key:'upper',lift:.9,stand:true,r:[2.0,3.2]}];
 const buckets={lower:[],middle:[],upper:[]};
 trees.forEach((tree,ti)=>{const cx=tree.position.x,cz=tree.position.z;
  tiers.forEach((tier,tk)=>{for(let i=0;i<10;i++){
   const a=i/10*Math.PI*2+ti*1.3+tk*.7+(random()-.5)*.25;
   const rr=tier.r[0]+(tier.r[1]-tier.r[0])*((i*.618+ti*.37)%1);
   const x=cx+Math.cos(a)*rr,z=cz+Math.sin(a)*rr,y=heightAt(x,z)+tier.lift;
   const q=new T.Quaternion();
   if(tier.stand)q.setFromAxisAngle(V(0,1,0),Math.atan2(-Math.cos(a),-Math.sin(a)));
   else q.setFromAxisAngle(V(0,1,0),random()*6.28);
   const sc=.85+random()*.35,m=new T.Matrix4().compose(V(x,y,z),q,V(sc,sc,sc));
   buckets[tier.key].push({matrix:m,x,z});}}); });
 // Standing black-backed discs removed (tapestry pass r5): the plane-tree understory is woven verdure cards + companion hollyhocks.
 chunkInstances(group,'morris-plane-understory-lower-red-rosettes',rosetteGeometry(),rosetteMaterial(0),[...buckets.lower,...buckets.middle.map(e=>({...e,matrix:e.matrix.clone().multiply(new T.Matrix4().makeTranslation(0,-0.0,0))}))].map(e=>{const p=new T.Vector3(),q=new T.Quaternion(),sc=new T.Vector3();e.matrix.decompose(p,q,sc);p.y=heightAt(p.x,p.z)+.03;return{...e,matrix:new T.Matrix4().compose(p,new T.Quaternion().setFromAxisAngle(V(0,1,0),random()*6.28),sc)};}),40,{cast:false});
 return{lower:buckets.lower.length,middle:buckets.middle.length,upper:0};
}
