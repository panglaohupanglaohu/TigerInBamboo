import * as THREE from 'three';
// 湖沼水面笔触（2026-10-10 用户："水面的波纹是这个样子的吗？greg 你来看看"）。
// Greg 评估：旧做法是一张正弦条纹按固定网格打断，整片水面铺满同样长、同样间距的短横线，像瓷砖，不像画。
// 莫比斯的水：大部分是平静的色面；笔触只出现在有东西扰动水面的地方，而且长短不一、成簇、有留白。
//   1) 环纹：荷叶舟、浮上来换气的鲸、游泳的黑娃周围，一圈圈断续的环慢慢向外扩散，2.6 单位内淡出；
//   2) 零星水纹：只在噪声成簇的几小片水面上，有几条与画面横向平行（沿镜头右方向）的短线，长短随机、缓慢漂移；
//   3) 和墨线同一套距离规则：10 米外变淡，20 米外不画；水下不画。
// ?swampWaterMarks=0 回到旧条纹。
const MAX_EMITTERS = 12;
export function installSwampWaterMarks({swamp, enabled = new URLSearchParams(globalThis.location?.search || '').get('swampWaterMarks') !== '0'} = {}) {
  const report = {enabled, version: 1, emitters: 0};
  const inner = swamp?.userData?.inner || swamp;
  const water = inner?.getObjectByName?.('swamp-underground-waterline');
  if (!enabled || !water?.material) return {report, update() {}};
  const U = {
    uInv: {value: new THREE.Matrix4()}, uCamR: {value: new THREE.Vector2(1, 0)}, uCamP: {value: new THREE.Vector3()},
    uTime: {value: 0}, uScale: {value: 1}, uEm: {value: Array.from({length: MAX_EMITTERS}, () => new THREE.Vector4())},
    uMark: {value: new THREE.Color(0x2c6f80)},
  };
  const mat = water.material;
  // 2026-10-11 swampPaintWater 读取它，把笔触颜色调成目标图的淡白青（只改 uniform 值，不动注入）。
  water.userData.swampWaterMarkUniforms = U;
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uInv;\nvarying vec3 vSwIn;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSwIn=(uInv*modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec2 uCamR; uniform vec3 uCamP; uniform float uTime; uniform float uScale; uniform vec4 uEm[${MAX_EMITTERS}]; uniform vec3 uMark;
      varying vec3 vSwIn;
      float swH(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float swN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(swH(i),swH(i+vec2(1,0)),f.x),mix(swH(i+vec2(0,1)),swH(i+vec2(1,1)),f.x),f.y);}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 q=vSwIn.xz; vec2 R=normalize(uCamR); vec2 F=vec2(-R.y,R.x);
        float distW=length(vSwIn-uCamP)*uScale;
        float fade=1.-smoothstep(10.,20.,distW);
        float mark=0.;
        if(fade>0.){
          // 1) rings around whatever touches the water
          for(int i=0;i<${MAX_EMITTERS};i++){
            vec4 e=uEm[i]; if(e.z<=0.) continue;
            vec2 d=q-e.xy; float rr=length(d)-e.w; if(rr<0.||rr>2.6) continue;
            float ph=fract((rr-uTime*.32)/.62);
            float w=.05+.03*swN(vec2(atan(d.y,d.x)*4.,float(i)));
            float band=1.-smoothstep(w*.5,w,abs(ph-.5)*.62);
            float gap=step(.42,swN(vec2(atan(d.y,d.x)*3.2+float(i)*7.,rr*1.6-uTime*.2)));
            mark=max(mark,band*gap*e.z*(1.-rr/2.6));
          }
          // 2) a few loose horizontal strokes, only inside sparse noise patches
          float cluster=smoothstep(.62,.78,swN(q*.16+vec2(uTime*.01,0.)));
          if(cluster>0.){
            float u=dot(q,R),v=dot(q,F);
            float row=floor(v/.6),fv=fract(v/.6)-.5;
            float uu=u+uTime*.1*(swH(vec2(row,3.))-.5)+swH(vec2(row,7.))*10.;
            float seg=floor(uu/1.8),fu=fract(uu/1.8);
            float on=step(fu,.12+.4*swH(vec2(row,seg)))*step(.5,swH(vec2(seg,row*1.7)));
            float th=.035+.02*swH(vec2(row,seg+1.));
            mark=max(mark,on*cluster*(1.-smoothstep(th*.5,th,abs(fv)*.6))*.8);
          }
        }
        diffuseColor.rgb=mix(diffuseColor.rgb,uMark,mark*fade*.55);
      }`);
  };
  mat.customProgramCacheKey = () => 'swamp-water-marks-1';
  mat.needsUpdate = true;
  inner.updateWorldMatrix(true, false);
  const scale = new THREE.Vector3(); inner.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale); U.uScale.value = scale.x;
  const v = new THREE.Vector3(), r = new THREE.Vector3();
  const whales = []; inner.traverse(o => { if (o.userData?.swim) whales.push(o); });
  return {report, uniforms: U, update(time, camera) {
    inner.updateWorldMatrix(true, false);
    U.uInv.value.copy(inner.matrixWorld).invert(); U.uTime.value = time;
    if (camera) {
      v.copy(camera.position).applyMatrix4(U.uInv.value); U.uCamP.value.copy(v);
      r.set(1, 0, 0).applyQuaternion(camera.quaternion).transformDirection(U.uInv.value); if (Math.hypot(r.x, r.z) > 1e-3) U.uCamR.value.set(r.x, r.z);
    }
    let n = 0; const put = (x, z, s, rad) => { if (n < MAX_EMITTERS && s > .02) U.uEm.value[n++].set(x, z, s, rad); };
    for (const b of inner.userData.lotuses || []) put(b.position.x, b.position.z, .9, (b.userData.flowerCup?.radius ?? 3) * .95);
    for (const w of whales) { const s = w.userData.surfacing ?? 0; if (s > .2) put(w.position.x, w.position.z, s, 1.4 * (w.scale.x || 1)); }
    const feeder = inner.userData.flowerBoyActivities?.feeder; if (feeder) put(feeder.position.x, feeder.position.z, 1, .35);
    for (let i = n; i < MAX_EMITTERS; i++) U.uEm.value[i].set(0, 0, 0, 0);
    report.emitters = n;
  }};
}
