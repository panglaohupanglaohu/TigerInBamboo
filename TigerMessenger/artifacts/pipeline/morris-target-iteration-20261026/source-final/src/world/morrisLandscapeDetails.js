import * as T from 'three';
import {mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
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
function weatheredRockGeometry(){const p=[],c=[],ix=[],rings=[[-1,.42],[-.85,.8],[-.42,1],[.15,.98],[.65,.8],[1.04,.2]],rock=new T.Color(0xa8a18c),dark=new T.Color(0x7e8370),grass=new T.Color(0x7a8450);for(let j=0;j<rings.length;j++)for(let k=0;k<12;k++){const a=k/12*Math.PI*2,r=rings[j][1]*(1+.09*Math.sin(k*2.3+j*.4));p.push(Math.cos(a)*r,rings[j][0]+.045*Math.sin(k*2+j),Math.sin(a)*r);const col=dark.clone().lerp(rock,.35+.3*(Math.sin(k*1.8+j*.3)+1)/2).lerp(grass,j===5?.36:0);c.push(col.r,col.g,col.b);if(j<rings.length-1){const n=j*12+k,b=j*12+(k+1)%12;ix.push(n,n+12,b,b,n+12,b+12);}}const top=p.length/3;p.push(0,1.08,0);c.push(grass.r,grass.g,grass.b);for(let k=0;k<12;k++)ix.push(top,(rings.length-1)*12+(k+1)%12,(rings.length-1)*12+k);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(ix);g.computeVertexNormals();return g;}
export function installMorrisRockShoulders({root,heightAt,canDress=()=>true}){
 const points=[];for(const[x,z,s]of[[-9,-9,3.7],[-16,-7,3],[-5,-17,2.7],[0,-10,2.5],[-20,-16,2.8],[-10,3,2.2],[-25,-4,2],[-17,6,1.8]])if(canDress(x,z))points.push({x,z,s});
 const mesh=new T.InstancedMesh(weatheredRockGeometry(),new T.MeshStandardMaterial({vertexColors:true,roughness:.97}),points.length),d=new T.Object3D();mesh.name='morris-embedded-weathered-central-rock-shoulders';points.forEach((p,i)=>{d.position.set(p.x,heightAt(p.x,p.z)+p.s*.06,p.z);d.rotation.set(.1*Math.sin(i),i*2.1,.1*Math.cos(i));d.scale.set(p.s,p.s*.85,p.s*.8);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);});mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return{mesh,count:points.length};
}
