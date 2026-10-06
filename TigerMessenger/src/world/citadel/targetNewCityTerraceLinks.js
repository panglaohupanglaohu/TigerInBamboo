import * as T from 'three';

// Authored side-street candidate, not a WFC solver or a navigation connection.
export function createTargetNewCityTerraceLinks({castle,candidateRoot,sampleTerrain,width=1.35}={}) {
 if(!castle||!candidateRoot||typeof sampleTerrain!=='function')throw new TypeError('castle, candidateRoot and actual sampleTerrain required');
 if(!Number.isFinite(width)||width<.9||width>2)throw new RangeError('width must be .9..2');
 castle.updateWorldMatrix(true,true);candidateRoot.updateWorldMatrix(true,true);
 const inv=castle.matrixWorld.clone().invert(), group=new T.Group();group.name='target-new-city-terrace-links';group.userData.preserveCitadelMaterials=true;
 const report={version:'target-new-city-terrace-links-2-connected-spandrels',coordinateFrame:'castle-local',accepted:false,navigation:false,built:false,links:[],rejected:[],terrainSamples:0,triangleChecks:0,limitations:['Finite terrain probes; no continuous navigation certification.','Conservative triangle-prism clearance may reject an otherwise possible route.','Only same-side neighbouring house plots; original buildings and mountain remain unchanged.']};
 const material=new T.MeshStandardMaterial({color:'#dfd5b9',roughness:.96});material.userData.preserveCitadelMaterial=true;const owned=new Set();
 const houses=[];candidateRoot.traverse(o=>{const r=o.userData.stairCandidateReport;if(r)for(const h of r.houses||[]){const object=o.getObjectByName(h.id);if(object)houses.push({...h,object,matrix:inv.clone().multiply(object.matrixWorld)});}});
 // Real walking triangles, extruded upward for headroom, rather than large
 // scene AABBs. Include instance transforms on parapets and bridge pieces.
 const obstacles=[];
 candidateRoot.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position)return;let n=o,visible=true;while(n){if(!n.visible)visible=false;n=n.parent;}if(!visible)return;
  if(!(/surveyed-route|bridge.*(?:deck|landing|connector)|main.*(?:entry|step)|entrance-landing|entry-/i.test(o.name)||o.userData.targetWalkable))return;
  const p=o.geometry.attributes.position,idx=o.geometry.index;
  for(let k=0;k<(o.isInstancedMesh?o.count:1);k++){const matrix=inv.clone().multiply(o.matrixWorld);if(o.isInstancedMesh){const im=new T.Matrix4();o.getMatrixAt(k,im);matrix.multiply(im);}const tris=[];
   for(let i=0;i<(idx?.count||p.count);i+=3){const v=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(matrix));tris.push(v);}
   const box=new T.Box3().setFromPoints(tris.flat());box.max.y+=2.4;box.expandByScalar(.15);obstacles.push({name:o.name,box,tris});
  }
 });
 // Preserve the existing +Z door approach, including houses whose door
 // opening is authored by separate meshes and lacks a walkable tag.
 for(const h of houses){const half=Math.min(.9,h.size[0]*.28),z=h.size[2]/2;
  const v=[[-half,.25,z-.1],[half,.25,z-.1],[half,.25,z+1.4],[-half,.25,z+1.4]].map(p=>new T.Vector3(...p).applyMatrix4(h.matrix));
  const box=new T.Box3().setFromPoints(v);box.max.y+=2.4;box.expandByScalar(.15);obstacles.push({name:h.id+':door-approach',box,tris:[[v[0],v[1],v[2]],[v[0],v[2],v[3]]]});
 }
 const height=(x,z)=>{report.terrainSamples++;const h=sampleTerrain(x,z);const y=typeof h==='number'?h:h?.height;return Number.isFinite(y)?y:null;};
 function blocked(mesh){mesh.updateMatrix();mesh.geometry.computeBoundingBox();const localBox=mesh.geometry.boundingBox.clone().expandByScalar(.12),worldBox=localBox.clone().applyMatrix4(mesh.matrix),mi=mesh.matrix.clone().invert();
  for(const o of obstacles){if(!worldBox.intersectsBox(o.box))continue;for(const pts of o.tris){const top=pts.map(v=>v.clone().add(new T.Vector3(0,2.4,0))),faces=[pts,top];for(let i=0;i<3;i++){const j=(i+1)%3;faces.push([pts[i],pts[j],top[j]],[pts[i],top[j],top[i]]);}for(const f of faces){report.triangleChecks++;if(localBox.intersectsTriangle(new T.Triangle(...f.map(v=>v.clone().applyMatrix4(mi)))))return o.name;}}}return null;
 }
 for(const side of [-1,1]){const hs=houses.filter(h=>h.side===side).sort((a,b)=>a.row-b.row);for(let j=1;j<hs.length;j++){
  const a=hs[j-1],b=hs[j],id=`${a.id}--${b.id}`,parts=[],link={id,houses:[a.id,b.id],sourceMatrices:[a.matrix.toArray(),b.matrix.toArray()],arches:[],footprints:[]};
  // Outer flank, leaving the +Z door fronts and central stair untouched.
  const pa=new T.Vector3(side*(a.size[0]/2+width/2+.2),.25,0).applyMatrix4(a.matrix),pb=new T.Vector3(side*(b.size[0]/2+width/2+.2),.25,0).applyMatrix4(b.matrix);
  const dx=pb.x-pa.x,dz=pb.z-pa.z,length=Math.hypot(dx,dz),rise=pb.y-pa.y;if(length<1||length>24||Math.abs(rise)/length>.65){report.rejected.push({id,reason:'span-or-grade',length,rise});continue;}
  const ux=dx/length,uz=dz/length,nx=-uz,nz=ux,yaw=-Math.atan2(uz,ux);let deckHeights=null;const at=(s,across=0)=>{let y=pa.y+rise*s/length;if(deckHeights){const u=Math.max(0,Math.min(deckHeights.length-1,s/length*(deckHeights.length-1))),i=Math.min(deckHeights.length-2,Math.floor(u));y=T.MathUtils.lerp(deckHeights[i],deckHeights[i+1],u-i);}return new T.Vector3(pa.x+ux*s+nx*across,y,pa.z+uz*s+nz*across);};
  let reason=null;const samples=[];const count=Math.max(Math.ceil(length/.28),Math.ceil(Math.abs(rise)/.2));
  for(let i=0;i<=count;i++)for(const v of [-width/2,0,width/2]){const p=at(length*i/count,v),y=height(p.x,p.z);if(y===null)reason='missing-terrain';else if(y>p.y-.23)reason='buried-deck';samples.push({position:p.toArray(),terrain:y});}
  if(reason==='buried-deck'&&!samples.some(s=>s.terrain===null)){const heights=Array.from({length:count+1},(_,i)=>Math.max(pa.y+rise*i/count,...samples.slice(i*3,i*3+3).map(s=>s.terrain+.3))),limit=.65*length/count;for(let i=1;i<=count;i++)heights[i]=Math.max(heights[i],heights[i-1]-limit);for(let i=count-1;i>=0;i--)heights[i]=Math.max(heights[i],heights[i+1]-limit);if(heights[0]<=pa.y+.01&&heights[count]<=pb.y+.01&&heights.every((y,i)=>y-(pa.y+rise*i/count)<=1.5)){deckHeights=heights;reason=null;link.terrainFollowing=true;for(let i=0;i<samples.length;i++)samples[i].position[1]=heights[Math.floor(i/3)];}}
  if(reason){report.rejected.push({id,reason});continue;}
  const add=(geometry,pos)=>{const mesh=new T.Mesh(geometry,material);mesh.name=id+'-'+parts.length;mesh.position.copy(pos);mesh.rotation.y=yaw;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.preserveCitadelMaterials=true;parts.push(mesh);return mesh;};
  const box=(x,y,z,p)=>add(new T.BoxGeometry(x,y,z),p);
  const ds=length/count;for(let i=0;i<count;i++){const p=at(ds*(i+.5));p.y=Math.max(at(ds*i).y,at(ds*(i+1)).y)-.11;box(ds+.015,.22,width,p);const wall=at(ds*(i+.5),width/2-.1);wall.y=p.y+.4;box(ds+.015,.58,.18,wall);}
  // Several real open semicircular bays; piers are separately sampled to
  // the final ground. No solid box fills the opening behind the arch.
  const bays=Math.max(1,Math.ceil(length/5)),span=length/bays,pier=.4;
  for(let k=0;k<=bays;k++){const s=k*span,p=at(s),heights=[];for(const e of[-pier/2,pier/2])for(const w of[-width/2,width/2]){const q=at(Math.max(0,Math.min(length,s+e)),w);heights.push(height(q.x,q.z));}if(heights.some(v=>v===null)){reason='missing-pier-ground';break;}const bottom=Math.min(...heights)-.12,top=p.y-.22;if(top-bottom>.08)box(pier,top-bottom,width,new T.Vector3(p.x,(bottom+top)/2,p.z));}
  for(let k=0;k<bays;k++){const s=(k+.5)*span,p=at(s),r=(span-pier)/2,top=Math.min(at(k*span).y,at((k+1)*span).y)-.23,ground=Math.max(...[-.65,0,.65].flatMap(t=>[-width/2,0,width/2].map(w=>{const q=at(s+t*r,w);return height(q.x,q.z)??Infinity;}))),archH=Math.min(r,2.2,top-ground-.45);if(archH<.45)continue;const shape=new T.Shape();const steps=12;for(let i=0;i<=steps;i++){const t=Math.PI-i*Math.PI/steps,x=Math.cos(t)*r,y=Math.sin(t)*archH;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);}for(let i=steps;i>=0;i--){const t=Math.PI-i*Math.PI/steps;shape.lineTo(Math.cos(t)*(r+.22),Math.sin(t)*(archH+.22));}shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false,steps:1});g.translate(0,0,-width/2);add(g,new T.Vector3(p.x,top-archH-.22,p.z));// Solid spandrel follows the curved outer arch up to the actual stepped
  // deck. Its lower boundary stays outside the opening; no facade patch.
  const spring=top-archH-.22, outerR=r+.22, spandrel=new T.Shape();
  for(let i=0;i<=steps;i++){const t=Math.PI-i*Math.PI/steps,x=Math.cos(t)*outerR,y=Math.sin(t)*(archH+.22);if(i===0)spandrel.moveTo(x,y);else spandrel.lineTo(x,y);}
  // Resolve every tread boundary as well as the two ends: the masonry top
  // meets the underside, including terrain-following rises, without a gap.
  const cuts=[outerR,-outerR];for(let i=0;i<=count;i++){const x=i*ds-s;if(x>-outerR&&x<outerR)cuts.push(x);}cuts.sort((a,b)=>b-a);
  for(let i=0;i<cuts.length-1;i++){const x0=cuts[i],x1=cuts[i+1],mid=s+(x0+x1)/2,j=Math.max(0,Math.min(count-1,Math.floor(mid/ds))),deckBottom=Math.max(at(ds*j).y,at(ds*(j+1)).y)-.22;spandrel.lineTo(x0,deckBottom-spring);spandrel.lineTo(x1,deckBottom-spring);}
  spandrel.closePath();const sg=new T.ExtrudeGeometry(spandrel,{depth:width,bevelEnabled:false,steps:1});sg.translate(0,0,-width/2);add(sg,new T.Vector3(p.x,spring,p.z));
  link.arches.push({center:[p.x,spring,p.z],openingWidth:r*2,openingHeight:archH,through:true,spandrelToDeck:true,depth:width,deckUnderside:[at(k*span).y-.22,at((k+1)*span).y-.22]});}
  for(const m of parts){const hit=blocked(m);if(hit){reason='walk-clearance:'+hit;break;}}
  if(reason){parts.forEach(m=>m.geometry.dispose());report.rejected.push({id,reason});continue;}
  for(const m of parts){owned.add(m.geometry);group.add(m);}link.endpoints=[pa.toArray(),pb.toArray()];link.samples=samples;link.meshMatrices=parts.map(m=>{m.updateMatrix();return m.matrix.toArray();});link.steps=count;link.maxStepRise=Math.max(...Array.from({length:count},(_,i)=>Math.abs(at(length*(i+1)/count).y-at(length*i/count).y)));report.links.push(link);
 }}
 if(group.children.length){const pos=[],norm=[];for(const m of [...group.children]){m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);pos.push(...g.attributes.position.array);norm.push(...g.attributes.normal.array);g.dispose();m.geometry.dispose();group.remove(m);}owned.clear();const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));owned.add(g);const m=new T.Mesh(g,material);m.name='target-new-city-terrace-links-stone';m.castShadow=m.receiveShadow=true;group.add(m);}
 report.built=report.links.length>0;report.drawCalls=group.children.length;report.triangles=group.children.reduce((s,m)=>s+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);group.userData.terraceLinksReport=report;let disposed=false;
 return{group,report,dispose(){if(disposed)return;disposed=true;group.removeFromParent();owned.forEach(g=>g.dispose());material.dispose();group.clear();}};
}
