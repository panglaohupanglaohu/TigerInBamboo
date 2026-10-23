import * as THREE from 'three';

// Current-courier target: cool jade masses, pale sage undersides and restrained
// warm accents. This comparison flag changes colour only, never crown geometry.
export function useSwampTargetFoliage(){
  return new URLSearchParams(globalThis.location?.search||'').get('gregTargetFoliage')!=='0';
}

// The palette pass calls this on its shared canopy material. Width and LOD
// depend on the actual projected UV footprint: a large distant leaf still
// carries five sparse veins, without drawing sub-pixel lines on tiny crowns.
export function applySwampCanopyInk(material){
  const target=useSwampTargetFoliage();
  material.onBeforeCompile=shader=>{
    shader.uniforms.gregFanInk={value:new THREE.Color(0x626478)};
    shader.uniforms.gregFanUnder={value:new THREE.Color(target?0x96b29d:0xb9e07a)};
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec2 gregFanCoord;\nvarying float gregFanSide;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\ngregFanCoord = uv;\n#ifdef USE_COLOR\ngregFanSide = step(.97, color.r);\n#else\ngregFanSide = 1.0;\n#endif');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nuniform vec3 gregFanInk;\nuniform vec3 gregFanUnder;\nvarying vec2 gregFanCoord;\nvarying float gregFanSide;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float radius = length(gregFanCoord);
        // Leaf top: deeper toward the stem, lighter at the rim. Underside: paler, greyer green.
        bool gregTop = gregFanSide > .5 && gl_FrontFacing;
        if (gregTop) diffuseColor.rgb *= mix(.80, 1.06, smoothstep(.12, .92, radius));
        else diffuseColor.rgb = mix(diffuseColor.rgb, gregFanUnder, ${target?'.30':'.45'}) * mix(.92, 1.0, smoothstep(.2, .9, radius));
        float angle = atan(gregFanCoord.x, gregFanCoord.y);
        float footprint = max(fwidth(angle), 0.0001);
        float veinDistance = min(abs(angle), min(min(abs(angle-.75),abs(angle+.75)),min(abs(angle-1.50),abs(angle+1.50))));
        float vein = 1.0-smoothstep(footprint*.20,footprint*.95,veinDistance);
        float projectedFade = 1.0-smoothstep(.07,.20,footprint);
        float reach = smoothstep(.10,.20,radius)*(1.0-smoothstep(.88,.99,radius));
        float edgeFootprint = max(fwidth(radius),.00015);
        float edge = 1.0-smoothstep(edgeFootprint*.20,edgeFootprint*1.05,abs(1.0-radius));
        float edgeFade = 1.0-smoothstep(.045,.11,edgeFootprint);
        diffuseColor.rgb = mix(diffuseColor.rgb,gregFanInk,max(vein*reach*projectedFade*.52,edge*edgeFade*.42));
      `);
  };
  material.customProgramCacheKey=()=> target?'greg-lake-fan-veins-v7-target-sage':'greg-lake-fan-veins-v5-moebius-green';
  material.userData.gregCanopyInk={version:3,veins:5,ink:'#626478',width:'screen derivative',lod:'projected leaf footprint',extraDrawCalls:0,foliageRevision:target?'target-sage-2':'moebius-green-5'};
  return material;
}

// A closed, scalloped fan leaf with an actual thin underside. All crowns share
// this geometry; radial veins are a local material hook, not extra line meshes.
function fanGeometry(central=false,compact=false){
  // Six radial samples soften the old three large hinged panels. Rim leaves
  // keep their accepted source geometry; only central shelter leaves change.
  const n=32,rings=compact?[.16,.32,.50,.68,.84,1]:[.35,.72,1],spread=Math.PI*(central?.56:1.28),positions=[],uv=[],colors=[],indices=[],skin=compact?.003:.006;
  const add=(x,y,z,shade)=>{positions.push(x,y,z);uv.push(x,z);colors.push(shade,shade,shade);};
  for(const side of [1,-1]){
    add(0,side*skin,0,side>0?1:.94);
    for(const t of rings)for(let i=0;i<=n;i++){
      const a=-spread/2+spread*i/n,r=t*(1+.07*Math.cos(a*6)+.018*Math.sin(a*3));
      // The middle rises into an umbrella; the last ring curls below the stem.
      // One coherent top plane avoids the old alternating pie-slice shading.
      const dome=compact?.17*Math.sin(t*Math.PI)-.045*t**4:(central?.53:.42)*Math.sin(t*Math.PI)-(central?.26:.17)*t**4;
      const edgeDrop=(compact?.012:.035)*t**3*(1-Math.cos(a*6))+(central?(compact?.025:.09)*Math.sin(a*2.7+.3)*t*t:0);
      add(Math.sin(a)*r,dome-edgeDrop+side*skin,Math.cos(a)*r,side>0?1:.94);
      // Veins and the narrow edge band follow normalized leaf radius, even
      // where the physical edge is scalloped.
      const veinAngle=a+.055*Math.sin(t*Math.PI)*Math.sin(a*2.1+.4);
      uv[uv.length-2]=Math.sin(veinAngle)*t;uv[uv.length-1]=Math.cos(veinAngle)*t;
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

function fittedFan(geometry,anchor,box,yaw,fraction,layer=0,central=false,compact=false){
  const pitch=central?(compact?[.04,.18,-.10]:[.08,.56,-.18])[layer]:.24+.10*Math.cos(yaw)+layer*.18,roll=central?(compact?[-.08,.12,-.04]:[-.18,.23,-.08])[layer]:.13*Math.sin(yaw)+layer*.08;
  const rotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pitch,yaw,roll,'YXZ')),
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
  if(central){const lateral=Math.min(scale.x,scale.z);scale.x=lateral;scale.z=lateral;}
  scale.y=Math.min(scale.y,Math.min(scale.x,scale.z)*(compact?.9:1.35))*(central?(compact?.72:.94):.50);
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
  const compact=new URLSearchParams(globalThis.location?.search||'').get('gregTargetCanopy')!=='0';
  const clearance=new URLSearchParams(globalThis.location?.search||'').get('gregCanopyClearance')!=='0';
  // 24 inner units above the 40-unit rim = 12 world metres at production .5 scale.
  // This raises the foliage itself; the camera, players, old branches and collision stay fixed.
  const clearanceY=64,petioles=[];
  inner.updateWorldMatrix(true,true);
  const innerInverse=inner.matrixWorld.clone().invert();
  const geometry=fanGeometry(),centralGeometry=fanGeometry(true,compact),plans=[],records=[];
  const disposeGeometry=()=>{geometry.dispose();centralGeometry.dispose();};
  let oldTriangles=0;
  for(const source of sources){
    const central=source.name==='v2-central-crown-batch',groupSize=central?18:7,anchors=source.parent.children.filter(n=>n.name===(central?'v2-world-tree-branch':'v2-rim-crown'));
    if(anchors.length*groupSize!==source.count){disposeGeometry();return {ok:false,reason:'crown groups no longer match branch anchors'};}
    const matrices=[],leafGeometry=central?centralGeometry:geometry,frame=innerInverse.clone().multiply(source.parent.matrixWorld),inverseFrame=frame.clone().invert();
    for(let i=0;i<anchors.length;i++){
      const originalBox=groupEnvelope(source,i*groupSize,groupSize),box=originalBox.clone(),anchor=central?branchEnd(anchors[i]):anchors[i].position.clone();
      if(!anchor||!box.containsPoint(anchor)){disposeGeometry();return {ok:false,reason:'branch endpoint lies outside original crown envelope'};}
      // Restore a branch-sized crown above the lake opening. The former 2.2x
      // lateral / 3.5x vertical expansion made a lid in the real rim view.
      // Branch tips and protected shore levels stay fixed in both variants.
      if(central){
        const lateral=compact?1.25:2.2,vertical=compact?1.5:3.5;
        for(const axis of ['x','z']){box.min[axis]=anchor[axis]+(box.min[axis]-anchor[axis])*lateral;box.max[axis]=anchor[axis]+(box.max[axis]-anchor[axis])*lateral;}
        box.min.y=Math.max(47,anchor.y+(box.min.y-anchor.y)*vertical);
        box.max.y=anchor.y+(box.max.y-anchor.y)*vertical;
      }
      // Staggered, coherently coloured leaves share the real branch end.
      // Their different yaw and dome reveal leafy overlap rather than a flat disc.
      // Original rim envelopes and expanded central shelter envelopes bind each vertex.
      const groupPlans=[];
      for(let j=0;j<(central?3:2);j++){
        const yaw=i*2.399+j*(central?Math.PI*2/3:1.82);
        const matrix=fittedFan(leafGeometry,anchor,box,yaw,j===0?.94:j===1?.89:.81,j,central,central&&compact);
        if(!matrix){disposeGeometry();return {ok:false,reason:'degenerate crown envelope'};}
        groupPlans.push(matrix);
      }
      let minimumY=Infinity;const v=new THREE.Vector3();
      for(const matrix of groupPlans)for(let j=0;j<leafGeometry.attributes.position.count;j++){
        v.fromBufferAttribute(leafGeometry.attributes.position,j).applyMatrix4(matrix).applyMatrix4(frame);minimumY=Math.min(minimumY,v.y);
      }
      const lift=clearance?Math.max(0,clearanceY-minimumY):0,oldAnchor=anchor.clone();
      const raisedInner=anchor.clone().applyMatrix4(frame).add(new THREE.Vector3(0,lift,0)),raised=raisedInner.applyMatrix4(inverseFrame),shift=raised.clone().sub(anchor);
      if(lift>1e-5)petioles.push({parent:source.parent,a:oldAnchor.clone(),b:raised.clone(),central});
      box.translate(shift);
      for(const matrix of groupPlans){
        matrix.elements[12]+=shift.x;matrix.elements[13]+=shift.y;matrix.elements[14]+=shift.z;
        records.push({source:source.name,parent:source.parent,group:i,instance:matrices.length,anchor:raised.toArray(),branchAnchor:oldAnchor.toArray(),liftInner:lift,minInnerY:minimumY+lift,bounds:[box.min.toArray(),box.max.toArray()],originalBounds:[originalBox.min.toArray(),originalBox.max.toArray()],expandedCentral:central});matrices.push(matrix);
      }
    }
    plans.push({source,matrices,leafGeometry});oldTriangles+=(source.geometry.index?.count??source.geometry.attributes.position.count)/3*source.count;
  }
  const visibility=new Map(),hide=o=>{if(!visibility.has(o))visibility.set(o,o.visible);o.visible=false;};
  const meshes=[],material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false,fog:false});
  for(const {source,matrices,leafGeometry}of plans){
    const mesh=new THREE.InstancedMesh(leafGeometry,material,matrices.length);mesh.name='greg-coral-fan-crown';mesh.userData.gregVisualRole='foliage';mesh.userData.gregFanVeins=true;
    mesh.userData.canopySource=source.name;mesh.raycast=()=>{};
    matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();source.parent.add(mesh);meshes.push(mesh);hide(source);
    for(const node of source.parent.children){
      if(['v2-world-tree-leaflets','v2-rim-leaflets','v2-central-crown-ink','v2-rim-crown-ink'].includes(node.name)){
        if(node.visible&&node.isInstancedMesh)oldTriangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3*node.count;
        hide(node);
      }
    }
  }
  // Physical slender stalks keep raised leaves attached rather than floating.
  // One shared tube template and one instanced draw for each affected tree.
  const petioleGeometry=new THREE.CylinderGeometry(.11,.17,1,5,1),petioleMaterial=new THREE.MeshBasicMaterial({color:0xb493a2,toneMapped:false});
  const petioleMeshes=[];
  for(const parent of new Set(petioles.map(p=>p.parent))){
    const list=petioles.filter(p=>p.parent===parent),mesh=new THREE.InstancedMesh(petioleGeometry,petioleMaterial,list.length*3);mesh.name='greg-raised-canopy-petioles';mesh.userData.gregVisualRole='bark';mesh.raycast=()=>{};
    let index=0;
    for(const p of list){
      const curve=new THREE.QuadraticBezierCurve3(p.a,p.a.clone().lerp(p.b,.5).add(new THREE.Vector3(.28,0,-.18)),p.b);
      for(let k=0;k<3;k++){
        const a=curve.getPoint(k/3),b=curve.getPoint((k+1)/3),delta=b.clone().sub(a);
        mesh.setMatrixAt(index++,new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()),new THREE.Vector3(p.central?1.8:1,delta.length(),p.central?1.8:1)));
      }
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();parent.add(mesh);petioleMeshes.push(mesh);
  }
  const report={ok:true,version:clearance?9:(compact?8:7),shapeRevision:clearance?'raised-camera-clearance-9':(compact?'compact-soft-central-clusters-8':'open-curved-central-clusters-7'),clearance:{enabled:clearance,minInnerY:Math.min(...records.map(r=>r.minInnerY)),requiredInnerY:clearanceY,rimInnerY:40,worldClearanceAtHalfScale:12,liftedGroups:petioles.length,petioleDraws:petioleMeshes.length},petioleMeshes,renderMeshes:meshes.length,instances:meshes.reduce((sum,m)=>sum+m.count,0),geometryTriangles:geometry.index.count/3,
    originalTriangles:oldTriangles,triangles:meshes.reduce((sum,m)=>sum+m.count*m.geometry.index.count/3,0),sharedGeometries:2,centralLeafSpreadDegrees:100.8,centralEnvelopeScale:compact?[1.25,1.5]:[2.2,3.5],centralRadialSegments:compact?6:3,meshes,records,
    dispose(){const materials=new Set([material,petioleMaterial]);for(const mesh of petioleMeshes){mesh.removeFromParent();materials.add(mesh.material);}petioleGeometry.dispose();for(const mesh of meshes){mesh.removeFromParent();materials.add(mesh.material);}for(const m of materials)m.dispose();disposeGeometry();for(const [node,visible]of visibility)node.visible=visible;if(inner.userData.gregCoralCanopy===report)delete inner.userData.gregCoralCanopy;}};
  inner.userData.gregCoralCanopy=report;return report;
}
