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
// Target has connected eroded rock shelves rather than spherical boulders.
function weatheredRockGeometry(){const p=[],c=[],ix=[],rings=[[-1.1,.54],[-.9,.88],[-.58,1],[-.15,.96],[.22,.73],[.52,.82],[.83,.53],[1,.34]],rock=new T.Color(0xc6c1ad),dark=new T.Color(0x8e9b9b),warm=new T.Color(0xd3c8aa),grass=new T.Color(0x7d8b56);for(let j=0;j<rings.length;j++)for(let k=0;k<16;k++){const a=k/16*Math.PI*2,r=rings[j][1]*(1+.07*Math.sin(k*1.9+.4)+.035*Math.cos(k*4.7+j*.3));p.push(Math.cos(a)*r,rings[j][0]+.025*Math.sin(k*2+j),Math.sin(a)*r);const col=dark.clone().lerp(rock,.43+.18*Math.cos(k*1.2)).lerp(warm,j%3===1?.23:.05).lerp(grass,j===rings.length-1?.8:0);c.push(col.r,col.g,col.b);if(j<rings.length-1){const n=j*16+k,b=j*16+(k+1)%16;ix.push(n,n+16,b,b,n+16,b+16);}}const top=p.length/3;p.push(0,1.015,0);c.push(grass.r,grass.g,grass.b);for(let k=0;k<16;k++)ix.push(top,(rings.length-1)*16+(k+1)%16,(rings.length-1)*16+k);const bottom=p.length/3;p.push(0,-1.11,0);c.push(dark.r,dark.g,dark.b);for(let k=0;k<16;k++)ix.push(bottom,k,(k+1)%16);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(ix);const faceted=g.toNonIndexed();faceted.computeVertexNormals();return faceted;}
export function installMorrisRockShoulders({root,heightAt,canDress=()=>true}){
 const points=[];for(const[x,z,wx,h,wz,yaw]of[[-12,-16,3.9,5.2,3.2,.3],[-17,-13,3.5,4.2,3.1,-.2],[-7,-17,3.3,4.1,3.3,.7],[-1,-14,3.1,3.4,3.1,.4],[-23,-7,3.3,3.0,3.3,-.4],[-23,0,2.5,2.7,3.0,.2],[-15,1,2.8,2.4,2.4,.6],[-5,-5,2.5,2.6,2.6,.1],[-28,-11,2.8,2.7,3.1,.4],[-18,-20,2.6,3.2,2.8,.6]]){const radius=Math.max(wx,wz);if(canDress(x,z)&&[0,Math.PI/2,Math.PI,Math.PI*1.5].every(a=>canDress(x+Math.cos(a)*radius*.65,z+Math.sin(a)*radius*.65)))points.push({x,z,wx,h,wz,yaw});}
 const mesh=new T.InstancedMesh(weatheredRockGeometry(),new T.MeshStandardMaterial({vertexColors:true,roughness:.98,flatShading:true}),points.length),d=new T.Object3D();mesh.name='morris-embedded-weathered-central-rock-shoulders';points.forEach((p,i)=>{d.position.set(p.x,heightAt(p.x,p.z)-p.h*.60,p.z);d.rotation.set(.035*Math.sin(i),p.yaw,.035*Math.cos(i));d.scale.set(p.wx*1.18,p.h*.36,p.wz*1.08);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);});mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;mesh.userData.targetRevision='embedded-faceted-ledges-r3';root.add(mesh);
 // Connected exposed strata follow the actual height field. Each fracture is
 // seated on the slope; grass survives on low-gradient shelves and road margins.
 const skinP=[],skinC=[],palette=[0xb2b4aa,0xbfc0b2,0xc9c4ae,0xa2aaa7].map(c=>new T.Color(c)),step=1.7;
 const sample=(x,z)=>[x,heightAt(x,z)+.14+.13*Math.abs(Math.sin(x*1.17+z*.83)),z];
 for(let z=-29;z<28;z+=step)for(let x=-36;x<40;x+=step){const rear=((x+12)/27)**2+((z+10)/24)**2<1,court=x>19&&z>3&&z<29;if(!rear&&!court)continue;const corners=[[x,z],[x+step,z],[x,z+step],[x+step,z+step]];if(!corners.every(([a,b])=>canDress(a,b)))continue;const cx=x+step/2,cz=z+step/2,slope=Math.hypot(heightAt(cx+.65,cz)-heightAt(cx-.65,cz),heightAt(cx,cz+.65)-heightAt(cx,cz-.65))/1.3;if(slope<.36)continue;const v=corners.map(([a,b])=>sample(a,b));for(const tri of[[0,2,1],[1,2,3]]){const col=palette[Math.abs(Math.floor(x*3+z*5))%palette.length];for(const k of tri){skinP.push(...v[k]);skinC.push(col.r,col.g,col.b);}}}
 const skinG=new T.BufferGeometry();skinG.setAttribute('position',new T.Float32BufferAttribute(skinP,3));skinG.setAttribute('color',new T.Float32BufferAttribute(skinC,3));skinG.computeVertexNormals();const skin=new T.Mesh(skinG,new T.MeshStandardMaterial({vertexColors:true,roughness:.98,flatShading:true,side:T.DoubleSide}));skin.name='morris-connected-exposed-fracture-slopes';skin.receiveShadow=skin.castShadow=true;root.add(skin);mesh.userData.targetRevision='connected-fracture-slopes-r5';return{mesh,count:points.length};
}
