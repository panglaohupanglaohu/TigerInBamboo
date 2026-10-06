import * as THREE from 'three';

/** A narrow, visible upstream channel joining the old-city terrace to its
 * spillway. Heights follow a monotone water surface and measured supports. */
export function createTargetOldCityWaterSupply({from,to,sampleSurface,width=2.8,colour='#eadbb8'}={}){
 if(!from||!to||![...from,...to,width].every(Number.isFinite)||width<=0||from[1]<to[1]||typeof sampleSurface!=='function')throw new TypeError('downstream channel and final surface sampler required');
 const dx=to[0]-from[0],dz=to[2]-from[2],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length,nx=-uz,nz=ux;
 const group=new THREE.Group();group.name='target-old-city-water-supply';group.userData.preserveCitadelMaterials=true;
 const stone=new THREE.MeshStandardMaterial({color:colour,roughness:.96,side:THREE.DoubleSide}),water=new THREE.MeshStandardMaterial({color:'#83d0d5',roughness:.35,metalness:0,emissive:'#358c92',emissiveIntensity:.12});
 for(const m of[stone,water])m.userData.preserveCitadelMaterial=true;
 const positions=[],wet=[],geometries=[],samples=[],failures=[];const N=Math.max(4,Math.ceil(length/.8));
 const points=Array.from({length:N+1},(_,i)=>{const f=i/N;return[from[0]+dx*f,from[1]+(to[1]-from[1])*f,from[2]+dz*f];});
 const V=(p,w,y=0)=>[p[0]+nx*w,p[1]+y,p[2]+nz*w];
 // Keep water above the final plateau until it actually reaches the cliff;
 // a straight descending plane would disappear into an otherwise flat terrace.
 const minimumY=points.map(p=>Math.max(...[-1,0,1].map(side=>{const q=V(p,side*(width/2+.3)),v=sampleSurface(q[0],q[2]),h=typeof v==='number'?v:v?.height;return Number.isFinite(h)?h+.14:-Infinity;})));
 let future=to[1];for(let i=N;i>=0;i--){future=Math.max(future,minimumY[i]);points[i][1]=Math.max(points[i][1],future);}
 if(points[0][1]>from[1]+1e-5||points[N][1]>to[1]+1e-5)failures.push({reason:'channel-endpoint-below-final-ground'});
 const quad=(a,b,c,d,out)=>out.push(...a,...b,...c,...a,...c,...d);
 for(let i=0;i<N;i++){
  const a=points[i],b=points[i+1],h=[];
  for(const p of[a,b])for(const side of[-1,0,1]){const q=V(p,side*(width/2+.3)),v=sampleSurface(q[0],q[2]),height=typeof v==='number'?v:v?.height;samples.push({x:q[0],z:q[2],ground:height??null,waterY:q[1]});if(!Number.isFinite(height))failures.push({segment:i,reason:'missing-ground'});else{h.push(height);if(height>q[1]-.12)failures.push({segment:i,reason:'buried-water-surface',penetration:height-(q[1]-.12)});}}
  const bottom=h.length?Math.min(...h)-.12:Math.min(a[1],b[1])-.22;
  for(const side of[-1,1]){
   const inner=side*width/2,outer=side*(width/2+.3),pa=V(a,inner,.42),pb=V(b,inner,.42),pc=V(b,outer,.42),pd=V(a,outer,.42);
   quad(pa,pb,pc,pd,positions);quad(V(a,inner,-.16),V(b,inner,-.16),pb,pa,positions);quad(pd,pc,[pc[0],bottom,pc[2]],[pd[0],bottom,pd[2]],positions);
  }
  quad(V(a,-width/2,-.13),V(a,width/2,-.13),V(b,width/2,-.13),V(b,-width/2,-.13),positions);
  quad(V(a,-width/2,0),V(b,-width/2,0),V(b,width/2,0),V(a,width/2,0),wet);
 }
 const report={version:'target-old-city-water-supply-1',from,to,width,length,waterProfile:points,samples,failures,built:failures.length===0,terrainChanged:false,flow:'downhill to sampled shoreline outlet',validation:{gpu:false,navigation:false}};
 // Reject rather than hiding terrain under a decorative blue stripe.
 if(report.built)for(const[data,material,name]of[[positions,stone,'channel-bank-stone'],[wet,water,'channel-running-water']]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));g.computeVertexNormals();geometries.push(g);const m=new THREE.Mesh(g,material);m.name=name;m.castShadow=name!=='channel-running-water';m.receiveShadow=true;group.add(m);}
 let disposed=false;return{group,report,dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometries.forEach(g=>g.dispose());stone.dispose();water.dispose();group.clear();}};
}
