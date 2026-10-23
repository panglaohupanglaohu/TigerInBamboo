import * as THREE from 'three';
// 湖沼目标图规则 4（TARGET_SPEC.md）：Moebius 墨线。
// 原来的反向外壳描线只在物体轮廓外沿成立：步道、浮板这种贴着水面的薄片，外壳落在水面下面被挡住，画面里几乎看不到线。
// 这里改成屏幕空间描线：先把整帧画进一张带深度的离屏图，再按“深度倒数的拉普拉斯”找近处物体的外轮廓和折角，
// 只描在近的一侧，线色 #4a4560，远处逐渐变淡。只在湖沼镜头生效时启用，其他场景照旧直接渲染。?swampInk=0 关闭。
// 正在给镜头让路的抖动叶片（swampOcclusionFade 的 alpha=0 标记）周围不描线，免得满屏墨点。
export function createSwampInkPost({renderer,isActive=()=>false,fadeUniforms=null,ink='#4a4560',strength=.9,
  enabled=new URLSearchParams(globalThis.location?.search||'').get('swampInk')==='1'}={}){
  const report={enabled,version:1,active:false,frames:0,width:0,height:0,px:2};
  const direct=(scene,camera)=>renderer.render(scene,camera);
  if(!enabled||!renderer?.capabilities?.isWebGL2)return {report,render:direct,dispose(){}};
  let rt=null;const size=new THREE.Vector2();
  const mat=new THREE.ShaderMaterial({
    uniforms:{tColor:{value:null},tDepth:{value:null},texel:{value:new THREE.Vector2()},cam:{value:new THREE.Vector2(.1,1000)},
      ink:{value:new THREE.Color(ink)},strength:{value:strength},px:{value:1.25},edge:{value:new THREE.Vector2(.07,.2)}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`#include <common>
      #include <packing>
      uniform sampler2D tColor;uniform sampler2D tDepth;uniform vec2 texel;uniform vec2 cam;uniform vec3 ink;uniform float strength;uniform float px;uniform vec2 edge;
      varying vec2 vUv;
      float invz(vec2 uv){float z=texture2D(tDepth,uv).x;return z>=.99999?0.:-1./perspectiveDepthToViewZ(z,cam.x,cam.y);}
      void main(){
        vec4 c=texture2D(tColor,vUv);
        vec2 o=texel*px;
        float i0=invz(vUv);
        float e=0.;
        if(i0>0.){
          vec4 cl=texture2D(tColor,vUv-vec2(o.x,0.)),cr=texture2D(tColor,vUv+vec2(o.x,0.)),cd=texture2D(tColor,vUv-vec2(0.,o.y)),cu=texture2D(tColor,vUv+vec2(0.,o.y));
          float mark=min(min(c.a,cl.a),min(min(cr.a,cd.a),cu.a));
          float il=invz(vUv-vec2(o.x,0.)),ir=invz(vUv+vec2(o.x,0.)),id=invz(vUv-vec2(0.,o.y)),iu=invz(vUv+vec2(0.,o.y));
          // 近侧轮廓：邻点更远（倒数更小）→ 正值；平面上恒为 0
          float lap=(4.*i0-il-ir-id-iu)/i0;
          float d=1./i0;
          e=smoothstep(edge.x,edge.y,lap)*(1.-.85*smoothstep(20.,65.,d))*step(.5,mark);
        }
        vec3 col=mix(c.rgb,ink*mix(.55,1.,clamp(dot(c.rgb,vec3(.3,.59,.11))*1.6,0.,1.))*(c.rgb*.35+.65),e*strength);
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
    depthTest:false,depthWrite:false,toneMapped:false});
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat);quad.frustumCulled=false;
  const qScene=new THREE.Scene();qScene.add(quad);const qCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  function ensure(){
    renderer.getDrawingBufferSize(size);
    if(rt&&rt.width===size.x&&rt.height===size.y)return;
    rt?.dispose();
    // 8 位 sRGB 离屏图（显存是半浮点的一半），采样时硬件转回线性，最后一道再编码输出。
    rt=new THREE.WebGLRenderTarget(size.x,size.y,{type:THREE.UnsignedByteType,colorSpace:THREE.SRGBColorSpace,samples:4,depthBuffer:true});
    rt.depthTexture=new THREE.DepthTexture(size.x,size.y);rt.depthTexture.type=THREE.UnsignedIntType;
    mat.uniforms.tColor.value=rt.texture;mat.uniforms.tDepth.value=rt.depthTexture;
    mat.uniforms.texel.value.set(1/size.x,1/size.y);report.width=size.x;report.height=size.y;
  }
  function render(scene,camera){
    let on=false;try{on=!!isActive()&&camera.isPerspectiveCamera;}catch{}
    report.active=on;
    if(!on)return direct(scene,camera);
    ensure();
    mat.uniforms.cam.value.set(camera.near,camera.far);
    mat.uniforms.px.value=report.px*Math.max(1,renderer.getPixelRatio());
    const prevRT=renderer.getRenderTarget();
    if(fadeUniforms?.uSwFadeMark)fadeUniforms.uSwFadeMark.value=1;
    try{renderer.setRenderTarget(rt);renderer.render(scene,camera);}
    finally{if(fadeUniforms?.uSwFadeMark)fadeUniforms.uSwFadeMark.value=0;renderer.setRenderTarget(prevRT);}
    renderer.render(qScene,qCam);report.frames++;
  }
  return {report,render,uniforms:mat.uniforms,dispose(){rt?.dispose();mat.dispose();quad.geometry.dispose();}};
}
