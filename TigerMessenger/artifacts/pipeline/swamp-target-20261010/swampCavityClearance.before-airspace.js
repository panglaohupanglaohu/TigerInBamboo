import * as THREE from 'three';
import {SWAMP_RIM_OUTER_MAX} from './swampCoralRim.js';
const RIM_CLEAR=(SWAMP_RIM_OUTER_MAX+1.0).toFixed(2);

// 2026-10-09 用户要求：把 Greg 八小时的湖沼实现完整放进真实场景。
// 检查发现：湖沼工厂内容与检查页一致，但正式场景里旧水晶城 V7 岸线（花园灌木、柏树、码头石、系缆桩、
// 岛阶、塔基）、moebius-metropolis 的绿丘/台地、城市湖面等旧几何仍然压在湖沼坑里和坑缘步道上，
// 所以正式游戏看起来和检查页不一样，也挡相机、挡路。这里把这些旧几何从湖沼空腔里清掉：
//   * 整个落在空腔内的网格直接隐藏；部分落入的网格删掉空腔内的三角形；实例网格隐藏空腔内的实例；
//   * 同步移除这些旧物件在空腔内的碰撞球、平台，并让旧 V7 岸线地面采样在空腔内不再生效。
// 湖沼自身（含虎、生物、活动）、玩家、载具不受影响。关闭：URL 参数 swampCavityClear=0。
export const SWAMP_CAVITY_OWNERS=['crystal-v7-shores','moebius-metropolis','city-sea-lake','crystal-sunset-clouds','planet-v9-runtime','planet-surface'];
// Inside planet-v9-runtime only the curved ocean shell is clipped (it otherwise forms a water ceiling over the sunken lake).
const OWNER_FILTER={'planet-v9-runtime':m=>/ocean/i.test(m.name)};

export function swampCavityTest(inner){
  const inv=new THREE.Matrix4(),v=new THREE.Vector3();
  const refresh=()=>{inner.updateWorldMatrix(true,false);inv.copy(inner.matrixWorld).invert();};refresh();
  // Inner frame (placement scale .5): bowl up to the rim crown, plus the rim walkway band above its top.
  const insideLocal=p=>{const r=Math.hypot(p.x,p.z);return (r<35.5&&p.y>4&&p.y<400)||(r<+RIM_CLEAR&&p.y>38.6&&p.y<400);};
  return {refresh,insideLocal,insideWorld:w=>insideLocal(v.copy(w).applyMatrix4(inv)),inverse:inv};
}

export function clearSwampCavity({scene,swamp,colliders=null,platforms=null,v7Shores=null,owners=SWAMP_CAVITY_OWNERS,
  enabled=new URLSearchParams(globalThis.location?.search||'').get('swampCavityClear')!=='0'}={}){
  const inner=swamp?.userData?.inner;if(!enabled||!inner||!scene)return {ok:false,reason:enabled?'no swamp':'disabled'};
  if(inner.userData.swampCavityClearance)return inner.userData.swampCavityClearance;
  const test=swampCavityTest(inner),local=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const report={ok:true,version:1,hiddenMeshes:[],clippedMeshes:[],hiddenInstances:0,removedTriangles:0,removedColliders:0,removedPlatforms:0,v7GroundMasked:false};
  const ownerRoots=owners.map(n=>scene.getObjectByName(n)).filter(Boolean);
  const hiddenCentres=[],partialMeshes=[];
  const uniform={value:new THREE.Matrix4().copy(test.inverse)},patched=new Set();
  function patchMaterial(m){
    if(m.userData.swampColumnFn&&m.onBeforeCompile===m.userData.swampColumnFn)return;
    m.userData.swampColumnRepatch=(m.userData.swampColumnRepatch||0)+1;if(m.userData.swampColumnRepatch>6)return;
    patched.add(m);m.userData.swampColumnClip=true;
    const prev=m.onBeforeCompile,prevKey=m.customProgramCacheKey?.bind(m);
    m.onBeforeCompile=m.userData.swampColumnFn=(shader,renderer)=>{
      prev?.call(m,shader,renderer);
      const vs=shader.vertexShader,fs=shader.fragmentShader;
      const clip=`{ vec3 sl=(uSwampInv*vec4(vSwampWorld,1.0)).xyz; float sr=length(sl.xz);
          if((sr<35.5&&sl.y>4.0)||(sr<${RIM_CLEAR}&&sl.y>38.6)) discard; }`;
      if(!vs.includes('#include <project_vertex>')||!fs.includes('#include <clipping_planes_fragment>')){
        // Hand-written ShaderMaterial (e.g. the curved ocean): inject at the top of main().
        const vMain=/void\s+main\s*\(\s*(void)?\s*\)\s*\{/;
        if(!vMain.test(vs)||!vMain.test(fs)||!/\bposition\b/.test(vs))return;
        shader.uniforms.uSwampInv=uniform;
        shader.vertexShader=vs.replace(vMain,m=>`varying vec3 vSwampWorld;\n${m}\n vSwampWorld=(modelMatrix*vec4(position,1.0)).xyz;`);
        shader.fragmentShader=fs.replace(vMain,m=>`varying vec3 vSwampWorld;\nuniform mat4 uSwampInv;\n${m}\n ${clip}`);
        return;
      }
      shader.uniforms.uSwampInv=uniform;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSwampWorld;')
        .replace('#include <project_vertex>',`#include <project_vertex>
        #ifdef USE_INSTANCING
        vSwampWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;
        #else
        vSwampWorld=(modelMatrix*vec4(transformed,1.0)).xyz;
        #endif`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vSwampWorld;\nuniform mat4 uSwampInv;')
        .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        { vec3 sl=(uSwampInv*vec4(vSwampWorld,1.0)).xyz; float sr=length(sl.xz);
          if((sr<35.5&&sl.y>4.0)||(sr<${RIM_CLEAR}&&sl.y>38.6)) discard; }`);
    };
    m.customProgramCacheKey=()=>(prevKey?prevKey():'')+'|swamp-column-clip-1';
    m.needsUpdate=true;report.patchedMaterials=(report.patchedMaterials||0)+1;
  }
  // Some systems swap materials later (night grade, planet runtime): re-patch any new material once.
  report.update=()=>{test.refresh();uniform.value.copy(test.inverse);
    for(const mesh of partialMeshes)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(m&&m.onBeforeCompile!==m.userData?.swampColumnFn)patchMaterial(m);};
  for(const root of ownerRoots){
    root.updateWorldMatrix(true,true);
    const filter=OWNER_FILTER[root.name]||(()=>true);
    const meshes=[];root.traverse(o=>{if((o.isMesh||o.isInstancedMesh)&&o.geometry?.attributes?.position&&filter(o))meshes.push(o);});
    for(const mesh of meshes){
      const g=mesh.geometry,pos=g.attributes.position,toLocal=new THREE.Matrix4().multiplyMatrices(test.inverse,mesh.matrixWorld);
      if(!g.boundingSphere)g.computeBoundingSphere();
      if(mesh.isInstancedMesh){
        const m=new THREE.Matrix4(),zero=new THREE.Matrix4().makeScale(0,0,0);let changed=0;
        for(let k=0;k<mesh.count;k++){mesh.getMatrixAt(k,m);local.copy(g.boundingSphere.center).applyMatrix4(m).applyMatrix4(toLocal);if(test.insideLocal(local)){mesh.setMatrixAt(k,zero);changed++;hiddenCentres.push(local.clone());}}
        if(changed){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere?.();report.hiddenInstances+=changed;}
        continue;
      }
      // Cheap reject with the bounding sphere.
      local.copy(g.boundingSphere.center).applyMatrix4(toLocal);const s=new THREE.Vector3();mesh.matrixWorld.decompose(new THREE.Vector3(),new THREE.Quaternion(),s);
      const rad=g.boundingSphere.radius*Math.max(s.x,s.y,s.z)*2;// inner scale .5 -> x2
      if(Math.hypot(local.x,local.z)-rad>42||local.y+rad<4)continue;
      const index=g.index,triCount=(index?index.count:pos.count)/3;let inside=0;const keep=[];
      for(let t=0;t<triCount;t++){
        const i0=index?index.getX(t*3):t*3,i1=index?index.getX(t*3+1):t*3+1,i2=index?index.getX(t*3+2):t*3+2;
        a.fromBufferAttribute(pos,i0).applyMatrix4(toLocal);b.fromBufferAttribute(pos,i1).applyMatrix4(toLocal);c.fromBufferAttribute(pos,i2).applyMatrix4(toLocal);
        // Large terrain triangles can span the bowl with all corners outside: also test edge midpoints and centroid.
        let hit=test.insideLocal(a)||test.insideLocal(b)||test.insideLocal(c);
        if(!hit)for(const [u,w] of [[a,b],[b,c],[c,a]]){if(test.insideLocal(local.copy(u).add(w).multiplyScalar(.5))){hit=true;break;}}
        if(!hit)hit=test.insideLocal(local.copy(a).add(b).add(c).multiplyScalar(1/3));
        if(hit)inside++;else keep.push(i0,i1,i2);
      }
      if(!inside)continue;
      // Distance culling toggles .visible every frame, so also take the mesh off every render/raycast layer.
      if(inside===triCount){mesh.visible=false;mesh.layers.disableAll();mesh.userData.swampCavityHidden=true;report.hiddenMeshes.push(mesh.name||'(unnamed)');
        local.copy(g.boundingSphere.center).applyMatrix4(mesh.matrixWorld);hiddenCentres.push(local.clone().applyMatrix4(test.inverse));continue;}
      // Partial (large terrain, hills, sea): keep the geometry and discard only fragments inside the swamp column.
      partialMeshes.push(mesh);for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(m)patchMaterial(m);
      report.clippedMeshes.push(`${mesh.name||'(unnamed)'} ~${inside}/${triCount}`);report.removedTriangles+=inside;
    }
  }
  // Colliders and platforms of removed legacy objects inside the cavity.
  if(Array.isArray(colliders)){
    for(let i=colliders.length-1;i>=0;i--){const col=colliders[i];if(!col?.position)continue;local.copy(col.position).applyMatrix4(test.inverse);
      if(!test.insideLocal(local))continue;
      if(hiddenCentres.some(h=>h.distanceTo(local)<4)||col.mesh?.userData?.swampCavityHidden){colliders.splice(i,1);report.removedColliders++;}}
  }
  if(Array.isArray(platforms)){
    for(let i=platforms.length-1;i>=0;i--){const p=platforms[i];const m=p?.mesh;if(!m)continue;let owned=false;for(let q=m;q;q=q.parent)if(ownerRoots.includes(q)){owned=true;break;}
      if(!owned||!p.center)continue;local.copy(p.center).applyMatrix4(test.inverse);if(test.insideLocal(local)){platforms.splice(i,1);report.removedPlatforms++;}}
  }
  // The old V7 promenade under the rim lip is ground the courier could drop onto; inside the cavity it no longer counts.
  const sampler=v7Shores?.userData?.sampleGroundRadius;
  if(typeof sampler==='function'&&!sampler.swampCavityMasked){
    const masked=position=>{test.refresh();return test.insideWorld(position)?null:sampler(position);};masked.swampCavityMasked=true;
    v7Shores.userData.sampleGroundRadius=masked;report.v7GroundMasked=true;
  }
  report.hiddenCount=report.hiddenMeshes.length;report.clippedCount=report.clippedMeshes.length;
  inner.userData.swampCavityClearance=report;return report;
}
