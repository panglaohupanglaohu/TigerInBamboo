// Archive the original factory output without baking, simplifying or recoloring it.
export function captureObject(root, provenance = {}) {
  root.updateMatrixWorld(true);
  const geometries={}, materials={}, textures={}, nodes=[], warnings=[];
  const geometryIds=new Map(), materialIds=new Map(), textureIds=new Map();
  function ref(map,obj,prefix){if(!map.has(obj))map.set(obj,`${prefix}${map.size}`);return map.get(obj);}
  const gid=o=>ref(geometryIds,o,'g'),mid=o=>ref(materialIds,o,'m'),tid=o=>ref(textureIds,o,'t');
  const ids=new Map();root.traverse(o=>ids.set(o,`n${ids.size}`));
  function safe(value, seen=new WeakSet(), depth=0) {
    if(value==null||typeof value==='string'||typeof value==='boolean'||typeof value==='number')return value;
    if(typeof value==='function')return {runtimeFunction:value.toString()};
    if(value.isObject3D)return {nodeRef:ids.get(value)??value.uuid};
    if(value.isMaterial)return {materialRef:mid(value)};
    if(value.isTexture)return {textureRef:tid(value)};
    if(value.isVector2||value.isVector3||value.isVector4||value.isQuaternion||value.isColor)return value.toArray();
    if(depth>5)return '[nested runtime state]';
    if(typeof value!=='object')return String(value);
    if(seen.has(value))return '[circular runtime state]';
    seen.add(value);
    const out=Array.isArray(value)?value.map(v=>safe(v,seen,depth+1)):Object.fromEntries(Object.entries(value).map(([k,v])=>[k,safe(v,seen,depth+1)]));
    seen.delete(value);return out;
  }
  function texture(t) {
    if(textures[tid(t)])return;
    const image=t.image, out={uuid:t.uuid,name:t.name,colorSpace:t.colorSpace,flipY:t.flipY,wrapS:t.wrapS,wrapT:t.wrapT,minFilter:t.minFilter,magFilter:t.magFilter,repeat:t.repeat.toArray(),offset:t.offset.toArray(),rotation:t.rotation,center:t.center.toArray()};
    try {
      if(image?.toDataURL)out.png=image.toDataURL('image/png');
      else if(image?.data){out.data=Array.from(image.data);out.width=image.width;out.height=image.height;out.format=t.format;out.dataType=image.data.constructor.name;}
      else if(image?.width){const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);out.png=c.toDataURL('image/png');}
      else warnings.push(`texture ${t.uuid}: no raster source`);
    }catch(e){warnings.push(`texture ${t.uuid}: ${e.message}`);}
    textures[tid(t)]=out;
  }
  function material(m) {
    if(materials[mid(m)])return;
    const out={uuid:m.uuid,name:m.name,type:m.type};
    for(const [k,v] of Object.entries(m)){
      if(v?.isTexture){texture(v);out[k]={textureRef:tid(v)};}
      else if(v?.isColor)out[k]=v.toArray();
      else if(['string','boolean','number'].includes(typeof v))out[k]=v;
    }
    out.userData=safe(m.userData);
    out.onBeforeCompile=m.onBeforeCompile?.toString();
    if(m.isShaderMaterial){out.uniforms=safe(m.uniforms);warnings.push(`shader material ${m.uuid}: runtime shader retained, Blender preview requires adaptation`);}
    materials[mid(m)]=out;
  }
  function attribute(a){
    const values=[];
    for(let i=0;i<a.count;i++)for(let j=0;j<a.itemSize;j++)values.push(a.getComponent(i,j));
    return {itemSize:a.itemSize,normalized:a.normalized,values};
  }
  root.traverse(o=>{
    const n={id:ids.get(o),parent:ids.get(o.parent)??null,name:o.name,type:o.type,matrix:o.matrix.toArray(),visible:o.visible,castShadow:o.castShadow,receiveShadow:o.receiveShadow,renderOrder:o.renderOrder,layers:o.layers.mask,userData:safe(o.userData)};
    if(o.geometry){
      const g=o.geometry;n.geometry=gid(g);
      if(!geometries[gid(g)])geometries[gid(g)]={uuid:g.uuid,name:g.name,attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,attribute(a)])),index:g.index?Array.from(g.index.array):null,groups:g.groups,drawRange:{start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:null},morphAttributes:Object.fromEntries(Object.entries(g.morphAttributes).map(([k,as])=>[k,as.map(attribute)]))};
    }
    if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(material);n.materials=ms.map(mid);}
    if(o.isInstancedMesh){n.instances=[];for(let i=0;i<o.count;i++)n.instances.push(Array.from(o.instanceMatrix.array.slice(i*16,i*16+16)));if(o.instanceColor)n.instanceColor=attribute(o.instanceColor);}
    if(o.isSkinnedMesh){n.skeleton=safe(o.skeleton);warnings.push(`skinned mesh ${n.id}: needs rig migration`);}
    if(o.isLight)n.light={color:o.color.toArray(),intensity:o.intensity,distance:o.distance,decay:o.decay};
    nodes.push(n);
  });
  return {version:2,up:'Y',provenance,nodes,geometries,materials,textures,warnings};
}
