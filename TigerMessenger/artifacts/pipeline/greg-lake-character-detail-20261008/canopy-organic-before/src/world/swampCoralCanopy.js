import * as THREE from 'three';

// A closed, scalloped fan leaf with an actual thin underside. All crowns share
// this geometry; radial veins are a local material hook, not extra line meshes.
function fanGeometry(){
  const n=16,rings=[.35,.78,1],spread=Math.PI*1.28,positions=[],uv=[],colors=[],indices=[];
  const add=(x,y,z,shade)=>{positions.push(x,y,z);uv.push(x,z);colors.push(shade,shade,shade);};
  for(const side of [1,-1]){
    add(0,side*.006,0,side>0?1:.94);
    for(const t of rings)for(let i=0;i<=n;i++){
      const a=-spread/2+spread*i/n,r=t*(1+.055*Math.cos(a*9));
      // The middle rises into an umbrella; the last ring curls below the stem.
      // One coherent top plane avoids the old alternating pie-slice shading.
      const dome=.36*Math.sin(t*Math.PI)-.20*t**4;
      const edgeDrop=.045*t**3*(1-Math.cos(a*5));
      add(Math.sin(a)*r,dome-edgeDrop+side*.006,Math.cos(a)*r,side>0?1:.94);
      // Veins and the narrow edge band follow normalized leaf radius, even
      // where the physical edge is scalloped.
      uv[uv.length-2]=Math.sin(a)*t;uv[uv.length-1]=Math.cos(a)*t;
    }
  }
  const stride=1+rings.length*(n+1),tri=(a,b,c)=>indices.push(a,b,c);
  for(let s=0;s<2;s++){
    const off=s*stride,face=(a,b,c)=>s?tri(off+a,off+c,off+b):tri(off+a,off+b,off+c);
    for(let i=0;i<n;i++){
      face(0,1+i,2+i);
      for(let ring=0;ring<rings.length-1;ring++){
        const a=1+ring*(n+1)+i,b=a+n+1;face(a,b,b+1);face(a,b+1,a+1);
      }
    }
  }
  const boundary=[0,...rings.slice(0,-1).map((_,i)=>1+i*(n+1)),
    ...Array.from({length:n+1},(_,i)=>1+(rings.length-1)*(n+1)+i),
    ...rings.slice(0,-1).map((_,i)=>(i+1)*(n+1)).reverse(),0];
  for(let i=0;i<boundary.length-1;i++){
    const a=boundary[i],b=boundary[i+1];tri(a,a+stride,b+stride);tri(a,b+stride,b);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

function groupEnvelope(source,first,count){
  source.updateMatrix();source.geometry.computeBoundingBox();const box=new THREE.Box3(),matrix=new THREE.Matrix4();
  for(let i=first;i<Math.min(first+count,source.count);i++){source.getMatrixAt(i,matrix);matrix.premultiply(source.matrix);box.union(source.geometry.boundingBox.clone().applyMatrix4(matrix));}
  return box;
}

function branchEnd(branch){
  const geo=branch.geometry,p=geo?.attributes.position,radial=geo?.parameters?.radialSegments;
  if(!p||!Number.isInteger(radial))return null;
  const tip=new THREE.Vector3(),offset=p.count-radial-1;
  for(let i=0;i<radial;i++)tip.add(new THREE.Vector3().fromBufferAttribute(p,offset+i));
  branch.updateMatrix();return tip.divideScalar(radial).applyMatrix4(branch.matrix);
}

function fittedFan(geometry,anchor,box,yaw,fraction){
  const rotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.24+.10*Math.cos(yaw),yaw,.13*Math.sin(yaw),'YXZ')),
    p=geometry.attributes.position,rotated=new THREE.Box3();
  for(let i=0;i<p.count;i++)rotated.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(rotation));
  const scale=new THREE.Vector3();
  for(const axis of ['x','y','z']){
    const positive=rotated.max[axis],negative=-rotated.min[axis];
    const fit=Math.min(positive>1e-6?(box.max[axis]-anchor[axis])/positive:Infinity,negative>1e-6?(anchor[axis]-box.min[axis])/negative:Infinity);
    scale[axis]=fit*(axis==='y'?.9:fraction);
  }
  // Match lateral scale rather than the old absolute Y cap of three units,
  // which flattened large crowns into paper discs. Envelope remains binding.
  scale.y=Math.min(scale.y,Math.min(scale.x,scale.z)*1.35)*.38;
  if(!Number.isFinite(scale.x+scale.y+scale.z)||Math.min(scale.x,scale.y,scale.z)<=0)return null;
  const matrix=new THREE.Matrix4().makeScale(...scale).multiply(rotation);matrix.setPosition(anchor);return matrix;
}

// Install before applyGregLakeVisuals: that pass supplies the approved palette
// and calls the explicitly marked fan vein hook. Spherical tree fitting then
// moves old branches and their new crowns together through their common parent.
export function installSwampCoralCanopy(swamp,{enabled=new URLSearchParams(globalThis.location?.search||'').get('gregLakeCanopy')!=='0'}={}){
  const inner=swamp.userData.inner||swamp;
  if(inner.userData.gregCoralCanopy)return inner.userData.gregCoralCanopy;
  if(!enabled)return null;
  const sources=[];inner.traverse(o=>{if(o.isInstancedMesh&&['v2-central-crown-batch','v2-rim-foliage-lobes'].includes(o.name))sources.push(o);});
  if(!sources.length)return {ok:false,reason:'final V2 crown instances missing'};
  const geometry=fanGeometry(),plans=[],records=[];
  let oldTriangles=0;
  for(const source of sources){
    const central=source.name==='v2-central-crown-batch',groupSize=central?18:7,anchors=source.parent.children.filter(n=>n.name===(central?'v2-world-tree-branch':'v2-rim-crown'));
    if(anchors.length*groupSize!==source.count){geometry.dispose();return {ok:false,reason:'crown groups no longer match branch anchors'};}
    const matrices=[];
    for(let i=0;i<anchors.length;i++){
      const box=groupEnvelope(source,i*groupSize,groupSize),anchor=central?branchEnd(anchors[i]):anchors[i].position.clone();
      if(!anchor||!box.containsPoint(anchor)){geometry.dispose();return {ok:false,reason:'branch endpoint lies outside original crown envelope'};}
      // One continuous fan per branch prevents three overlapping, differently
      // colored surfaces from reading as triangular stone facets.
      for(let j=0;j<1;j++){
        const matrix=fittedFan(geometry,anchor,box,i*2.399,.94);
        if(!matrix){geometry.dispose();return {ok:false,reason:'degenerate crown envelope'};}
        records.push({source:source.name,parent:source.parent,group:i,instance:matrices.length,anchor:anchor.toArray(),bounds:[box.min.toArray(),box.max.toArray()]});matrices.push(matrix);
      }
    }
    plans.push({source,matrices});oldTriangles+=(source.geometry.index?.count??source.geometry.attributes.position.count)/3*source.count;
  }
  const visibility=new Map(),hide=o=>{if(!visibility.has(o))visibility.set(o,o.visible);o.visible=false;};
  const meshes=[],material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false,fog:false});
  for(const {source,matrices}of plans){
    const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);mesh.name='greg-coral-fan-crown';mesh.userData.gregVisualRole='foliage';mesh.userData.gregFanVeins=true;
    mesh.userData.canopySource=source.name;mesh.raycast=()=>{};
    matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();source.parent.add(mesh);meshes.push(mesh);hide(source);
    for(const node of source.parent.children){
      if(['v2-world-tree-leaflets','v2-rim-leaflets','v2-central-crown-ink','v2-rim-crown-ink'].includes(node.name)){
        if(node.visible&&node.isInstancedMesh)oldTriangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3*node.count;
        hide(node);
      }
    }
  }
  const report={ok:true,version:3,renderMeshes:meshes.length,instances:meshes.reduce((sum,m)=>sum+m.count,0),geometryTriangles:geometry.index.count/3,
    originalTriangles:oldTriangles,triangles:meshes.reduce((sum,m)=>sum+m.count,0)*geometry.index.count/3,sharedGeometries:1,meshes,records,
    dispose(){const materials=new Set([material]);for(const mesh of meshes){mesh.removeFromParent();materials.add(mesh.material);}for(const m of materials)m.dispose();geometry.dispose();for(const [node,visible]of visibility)node.visible=visible;if(inner.userData.gregCoralCanopy===report)delete inner.userData.gregCoralCanopy;}};
  inner.userData.gregCoralCanopy=report;return report;
}
