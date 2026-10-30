import * as T from 'three';
import {mergeGeometries,mergeVertices}from'three/addons/utils/BufferGeometryUtils.js';
// Bridge remains tied to the existing walkable deck; stone is real geometry.
export function dressMorrisBridge({bridge,deckY}){
 const buckets=new Map(),revision='continuous-arch-r3';let masonryPieces=0;
 function add(g,color,name){g.deleteAttribute('uv');const plain=g.index?g.toNonIndexed():g;if(plain!==g)g.dispose();if(!buckets.has(color))buckets.set(color,{name,geos:[]});buckets.get(color).geos.push(plain);}
 // Remove only this bridge's obsolete parapets/feet or a previous detail pass.
 for(const m of [...bridge.children])if(m.name==='bridge-low-stone-parapet'||m.name==='bridge-bank-footing'||m.userData.morrisBridgeDetail){bridge.remove(m);m.geometry?.dispose();m.material?.dispose();}
 const deckCrown=deckY(0)-(deckY(-4)+deckY(4))*.5;
 // Follow an intentionally higher deck crown without leaving a thick, flat
 // belly beneath it. The two bank seats and the original deck are untouched.
 const halfSpan=3.72,rise=1.58+Math.max(0,deckCrown-.25),band=.22;
 const springLine=z=>T.MathUtils.lerp(deckY(-halfSpan),deckY(halfSpan),(z+halfSpan)/(2*halfSpan))-2.05;
 const archBottom=z=>springLine(z)+rise*Math.sqrt(Math.max(0,1-(z/halfSpan)**2));
 const copingTop=z=>deckY(z)+.70+.05*Math.cos(z/4*Math.PI/2);
 // A closed six-sided longitudinal solid, following smooth deck/arch profiles.
 function strip(x0,x1,z0,z1,lower,upper,n=80){
  const p=[],ix=[];for(let j=0;j<=n;j++){const z=T.MathUtils.lerp(z0,z1,j/n),lo=lower(z),hi=upper(z);p.push(x0,lo,z,x1,lo,z,x0,hi,z,x1,hi,z);if(j<n){const a=j*4,b=a+4;ix.push(a,b,a+1,a+1,b,b+1,a+2,a+3,b+2,a+3,b+3,b+2,a,a+2,b,a+2,b+2,b,a+1,b+1,a+3,a+3,b+1,b+3);}}
  const q=n*4;ix.push(0,1,2,1,3,2,q,q+2,q+1,q+1,q+2,q+3);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;
 }
 // The solid core's underside is the actual opening; no upright sheet fills it.
 add(strip(-1.94,1.94,-4,4,archBottom,z=>deckY(z)-.025,128),0xbba47f,'bridge-continuous-stone-arch-core');
 for(const side of[-1,1]){
  const inner=side*1.6,outer=side*1.98,x0=Math.min(inner,outer),x1=Math.max(inner,outer);
  add(strip(x0,x1,-4,4,z=>deckY(z)-.04,z=>copingTop(z)-.12,112),0xbba47f,'bridge-continuous-stone-arch-core');
  const capInner=side*1.6,capOuter=side*2.08;
  add(strip(Math.min(capInner,capOuter),Math.max(capInner,capOuter),-4,4,z=>copingTop(z)-.13,copingTop,128),0xd1bb95,'bridge-continuous-stone-coping');
  // Shallow mortar lines and stone faces follow the continuous host surface.
  // Narrow joints never become deep slots or alter the smooth top silhouette.
  for(let row=0;row<3;row++)for(let j=0;j<16;j++){
   const z0=-4+j*.5+.012,z1=z0+.476,low=z=>deckY(z)+.025+row*.19,high=z=>low(z)+.168;
   const xa=side*1.982,xb=side*2.012;
   add(strip(Math.min(xa,xb),Math.max(xa,xb),z0,z1,low,high,4),[0xc3ac85,0xb29c79,0xcbb58f][(j+row*2)%3],'bridge-subtle-mortared-stone-faces');masonryPieces++;
  }
  for(let j=0;j<16;j++){
   const z0=-4+j*.5+.016,z1=z0+.468;
   add(strip(Math.min(side*2.082,side*2.092),Math.max(side*2.082,side*2.092),z0,z1,z=>copingTop(z)-.115,z=>copingTop(z)-.012,4),0xc3ac85,'bridge-subtle-mortared-stone-faces');
  }
  for(let row=0;row<8;row++)for(let j=0;j<16;j++){
   const z0=-4+j*.5+.014,z1=z0+.472,base=deckY(0)-2.25+row*.28;
   const low=z=>Math.max(base,archBottom(z)+.26),high=z=>Math.min(base+.245,deckY(z)-.06);
   if(Array.from({length:6},(_,k)=>high(T.MathUtils.lerp(z0,z1,k/5))-low(T.MathUtils.lerp(z0,z1,k/5))).some(h=>h<.045))continue;
   add(strip(Math.min(side*1.944,side*1.963),Math.max(side*1.944,side*1.963),z0,z1,low,high,5),[0xc3ac85,0xb29c79,0xcbb58f][(j+row)%3],'bridge-subtle-mortared-stone-faces');masonryPieces++;
  }
  // Proper wedge-shaped voussoirs lie between two continuous arch curves.
  const slope=(deckY(halfSpan)-deckY(-halfSpan))/(2*halfSpan);
  const point=(t,outer)=>{const z=-halfSpan*Math.cos(t),y=springLine(z)+rise*Math.sin(t),dz=halfSpan*Math.sin(t),dy=slope*dz+rise*Math.cos(t),len=Math.hypot(dz,dy);return{z:z-(outer?band*dy/len:0),y:y+(outer?band*dz/len:0)};};
  for(let j=0;j<26;j++){
   const t0=j*Math.PI/26+.003,t1=(j+1)*Math.PI/26-.003,p=[],indices=[];
   for(const xx of[side*1.944,side*2.022])for(const[t,o]of[[t0,false],[t1,false],[t1,true],[t0,true]]){const q=point(t,o);p.push(xx,q.y,q.z);}
   indices.push(0,1,2,0,2,3,4,7,6,4,6,5,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0);
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();add(g,j%3?0xcbb58f:0xd1bb95,'bridge-continuous-radial-voussoirs');masonryPieces++;
  }
  // Bank-end rubble is embedded below the end deck, outside the walk corridor.
  for(const end of[-1,1])for(let j=0;j<3;j++){
   const z=end*(3.24+j*.12),g=new T.DodecahedronGeometry(1,0);g.scale(.21,.18,.27);g.rotateY(j*.7);g.translate(side*(2.02+j*.06),deckY(z)-.18,z);add(g,j%2?0xb29c79:0xc3ac85,'bridge-embedded-bank-stones');
  }
 }
 for(const[color,b]of buckets){const g=mergeGeometries(b.geos,false);b.geos.forEach(g=>g.dispose());const m=new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:.94,side:T.DoubleSide}));m.name=b.name;m.userData.morrisBridgeDetail=revision;m.castShadow=m.receiveShadow=true;bridge.add(m);}
 const minimumCoreThickness=Math.min(...Array.from({length:257},(_,i)=>{const z=-4+i/32;return deckY(z)-.025-archBottom(z);}));
 bridge.userData.morrisBridgeDetail={revision,halfSpan,deckCrown,archRise:rise,minimumCoreThickness,clearWalkWidth:3.2,archBottomSamples:Array.from({length:65},(_,i)=>{const z=-4+i/8;return[z,archBottom(z)];})};
 return{revision,archBarrel:true,solidParapets:true,closedArchCore:true,continuousCoping:true,deckCrown,archRise:rise,minimumCoreThickness,walkWidth:3.2,span:8,archStones:52,masonryPieces,mergedStoneBatches:buckets.size,terrainBankContactVerified:false};
}
function rockRandom(seed){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
// Closed convex, weather-rounded volumes with overlapping rounded lobes.
// No horizontal shelf ring: the silhouette continuously tapers into the bank.
function weatheredRockGeometry(){
 const pos=[],ix=[],col=[],N=14,rings=[[-1.06,.22],[-.88,.62],[-.52,.91],[0,1.03],[.46,.92],[.79,.68],[.98,.30]],warm=new T.Color(0xe6cc99),shade=new T.Color(0xc2a77d);
 for(let j=0;j<rings.length;j++){const[y,r]=rings[j];for(let k=0;k<N;k++){const a=k/N*Math.PI*2,rr=r*(1+.045*Math.sin(k*2.1)+.03*Math.cos(k*3.4));pos.push(Math.cos(a)*rr,y+.035*Math.sin(k*1.6+j*.7),Math.sin(a)*rr);const c=shade.clone().lerp(warm,.50+j*.065);col.push(c.r,c.g,c.b);if(j<rings.length-1){const a=j*N+k,b=j*N+(k+1)%N;ix.push(a,b,a+N,b,b+N,a+N);}}}
 for(let k=1;k<N-1;k++){ix.push(0,k+1,k);const q=(rings.length-1)*N;ix.push(q,q+k,q+k+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(ix);g.computeVertexNormals();
 const left=g.clone().scale(.72,.76,.86).translate(-.77,-.23,.10),right=g.clone().scale(.65,.65,.75).translate(.73,-.32,-.08),mass=mergeGeometries([g,left,right],false);g.dispose();left.dispose();right.dispose();return mass;
}
export function installMorrisRockShoulders({root,heightAt,R=160,canDress=()=>true,canFace=canDress}){
 const radial=(x,z)=>Math.hypot(x,R+heightAt(x,z),z)-R,points=[];
 // Fixed staggered sites, ranked by slope and upland. Coarse semantic dressing,
 // not a scatter of micro-stones: each retained site is one connected rock mass.
 const random=rockRandom(0x4d4f5231),candidates=[];
 for(let trial=0;trial<340;trial++){const x=-53+108*random(),z=-43+101*random(),xx=x,zz=z,h=radial(xx,zz);if(h<4.5||h>40)continue;const gx=(radial(xx+.7,zz)-radial(xx-.7,zz))/1.4,gz=(radial(xx,zz+.7)-radial(xx,zz-.7))/1.4,slope=Math.hypot(gx,gz);if(slope<.26||slope>1.65||!canFace(xx,zz))continue;
 const yaw=Math.atan2(-gx,-gz)+(random()-.5)*.55,wx=2.5+random()*1.5,wz=1.25+random()*.8,cs=Math.cos(yaw),sn=Math.sin(yaw),sample=[];let allowed=true;
 for(let k=0;k<12;k++){const a=k/12*Math.PI*2,dx=Math.cos(a)*wx*1.7,dz=Math.sin(a)*wz*1.3,px=xx+dx*cs+dz*sn,pz=zz-dx*sn+dz*cs;if(!canFace(px,pz)){allowed=false;break;}sample.push(heightAt(px,pz));}
 if(!allowed)continue;const range=Math.max(...sample)-Math.min(...sample);if(range>5.0)continue;
 candidates.push({x:xx,z:zz,y:heightAt(xx,zz)-random()*.4,yaw,wx,wz,h:1.55+range*.22+random()*.4,spacing:4.8+random()*3.8,rank:slope+.018*h+random()*.8,footprintSamples:12});}
 candidates.sort((a,b)=>b.rank-a.rank);for(const p of candidates){if(points.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<Math.min(p.spacing,q.spacing)))continue;points.push(p);if(points.length>=36)break;}
 const mesh=new T.InstancedMesh(weatheredRockGeometry(),new T.MeshStandardMaterial({vertexColors:true,roughness:.98,flatShading:false}),points.length),d=new T.Object3D();mesh.name='morris-embedded-weathered-central-rock-shoulders';
 const seated=[];for(const p of points){
  const gx=(heightAt(p.x+.8,p.z)-heightAt(p.x-.8,p.z))/1.6,gz=(heightAt(p.x,p.z+.8)-heightAt(p.x,p.z-.8))/1.6;
  const tilt=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(-gx,1,-gz).normalize());
  d.quaternion.copy(tilt).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),p.yaw));d.scale.set(p.wx,p.h,p.wz);d.position.set(p.x,p.y,p.z);d.updateMatrix();
  // Every lower-ring vertex sits below terrain, not hanging as a cliff shelf.
  let sink=0;const v=new T.Vector3(),g=mesh.geometry.attributes.position;
  for(let j=0;j<g.count;j++)if(g.getY(j)<-.72){v.fromBufferAttribute(g,j).applyMatrix4(d.matrix);sink=Math.max(sink,v.y-heightAt(v.x,v.z)+.18);}
  p.y-=sink;p.sink=sink;d.position.y=p.y;d.updateMatrix();
  let allowed=true;for(let j=0;j<g.count;j++){v.fromBufferAttribute(g,j).applyMatrix4(d.matrix);if(!canFace(v.x,v.z)){allowed=false;break;}}if(!allowed)continue;
  mesh.setMatrixAt(seated.length,d.matrix);seated.push(p);
 }mesh.count=seated.length;mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;mesh.userData.targetRevision='seeded-irregular-rounded-rock-r11';mesh.userData.placementAudit={seed:0x4d4f5231,distribution:'seeded continuous random candidates with variable exclusion radius',candidateCount:candidates.length,retained:seated.length,closedRoundedRings:7,footprintCheck:12,transformedVertexProtection:true,lowerRingSeating:true,points:seated};root.add(mesh);return{mesh,count:seated.length};
}

// Closed, embedded shoreline masses replace the uninterrupted sandy rim.
// The protection callback is sampled around each footprint, including rail gaps.
export function installMorrisCoastRocks({root,heightAt,edge,R=160,canDress=()=>true}){
 const points=[],random=rockRandom(0x434f4131);
 // Random-length coast runs separated by longer empty arcs, not an equal-angle ring.
 for(let k=0,a=random()*.2;a<Math.PI*2&&k<96;k++,a+=.035+random()*.12){
  if(random()<.23){a+=.08+random()*.16;continue;}
  const r=edge(a)*(.935+random()*.037),x=Math.cos(a)*r,z=Math.sin(a)*r;
  const radial=Math.hypot(x,R+heightAt(x,z),z)-R;
  if(radial>4||!canDress(x,z))continue;
  const sx=1.7+random()*1.6,sz=1.1+random()*1.15,sy=.75+random()*.95;
  let allowed=true;for(let j=0;j<12;j++){const t=j/12*Math.PI*2;if(!canDress(x+Math.cos(t)*sx*1.55,z+Math.sin(t)*sz*1.15)){allowed=false;break;}}
  if(!allowed||points.some(p=>Math.hypot(p.x-x,p.z-z)<2.8))continue;points.push({x,z,sx,sy,sz,y:heightAt(x,z)-sy*(.25+random()*.35),yaw:a+(random()-.5)*1.3,pitch:(random()-.5)*.15,roll:(random()-.5)*.15});
 }
 const g=weatheredRockGeometry(),p=g.attributes.position,c=[],light=new T.Color(0xe2c795),dark=new T.Color(0xbda37c);
 for(let j=0;j<p.count;j++){const x=p.getX(j),y=p.getY(j),z=p.getZ(j),f=1+.025*Math.sin(x*9+z*6)*Math.cos(y*7);p.setXYZ(j,x*f,y*f,z*f);const col=dark.clone().lerp(light,.42+.25*y+.12*Math.sin(x*6+z*4));c.push(col.r,col.g,col.b);}
 g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeVertexNormals();
 const mesh=new T.InstancedMesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:false}),points.length),d=new T.Object3D();
 mesh.name='morris-closed-warm-rocky-coast';mesh.castShadow=mesh.receiveShadow=true;
 const seated=[];for(const q of points){d.position.set(q.x,q.y,q.z);d.rotation.set(q.pitch,q.yaw,q.roll);d.scale.set(q.sx,q.sy,q.sz);d.updateMatrix();let sink=0;const v=new T.Vector3();for(let j=0;j<p.count;j++)if(p.getY(j)<-.72){v.fromBufferAttribute(p,j).applyMatrix4(d.matrix);sink=Math.max(sink,v.y-heightAt(v.x,v.z)+.12);}q.y-=sink;d.position.y=q.y;d.updateMatrix();let allowed=true;for(let j=0;j<p.count;j++){v.fromBufferAttribute(p,j).applyMatrix4(d.matrix);if(!canDress(v.x,v.z)){allowed=false;break;}}if(!allowed)continue;mesh.setMatrixAt(seated.length,d.matrix);seated.push(q);}mesh.count=seated.length;mesh.userData.placementAudit={seed:0x434f4131,points:seated,transformedVertexProtection:true};mesh.computeBoundingSphere();root.add(mesh);
 return{mesh,count:seated.length,scope:'closed coast volumes, protected footprint samples; no navigation acceptance'};
}
