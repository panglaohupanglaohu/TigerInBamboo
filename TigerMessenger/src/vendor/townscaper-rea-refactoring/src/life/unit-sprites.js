/** 969860566322958336: "mostly symmetrical ... sword tips ... axe heads".
 * A procedural single-view sprite comparison, not the original game's artwork.
 */
import * as THREE from 'three';
import {chooseSpriteFlip} from '../core/sprite-ambiguity.js';
export function renderUnit({height=96,variant='sword',color='#527a9c'}={}){
  if(!Number.isInteger(height)||height<16||height>512||!['sword','axe','spear'].includes(variant))throw new RangeError('Invalid sprite');
  const canvas=document.createElement('canvas');canvas.width=height;canvas.height=height;const c=canvas.getContext('2d'),s=height/100;c.scale(s,s);c.lineJoin='round';
  const shape=(fill,draw)=>{c.beginPath();draw();c.fillStyle=fill;c.strokeStyle='#eaf0e5';c.lineWidth=3;c.fill();c.stroke()};
  shape(color,()=>{c.rect(35,45,30,37)});shape('#e0e5dc',()=>c.ellipse(50,29,12,16,0,0,7));shape(color,()=>c.arc(50,60,16,0,7));
  shape('#38576d',()=>c.rect(36,81,9,13));shape('#38576d',()=>c.rect(55,81,9,13));
  c.strokeStyle='#f0ecdc';c.lineWidth=4;c.beginPath();c.moveTo(74,76);c.lineTo(74,variant==='spear'?3:18);c.stroke();
  if(variant==='axe')shape('#d9e4de',()=>{c.moveTo(73,18);c.lineTo(94,20);c.lineTo(94,38);c.lineTo(73,32);c.closePath()});
  else shape('#e6e9df',()=>{c.moveTo(74,variant==='spear'?1:12);c.lineTo(69,26);c.lineTo(79,26);c.closePath()});
  return {canvas,data:c.getImageData(0,0,height,height)};
}
export class UnitSpriteBatch {
  constructor(limit=260) {
    this.group=new THREE.Group();this.group.visible=false;this.enabled=false;
    this.materials=[0,1].map(team=>{
      const {canvas}=renderUnit({color:team?'#a65147':'#527a9c'}),map=new THREE.CanvasTexture(canvas);
      map.colorSpace=THREE.SRGBColorSpace;map.minFilter=THREE.LinearFilter;map.magFilter=THREE.NearestFilter;
      const material=new THREE.ShaderMaterial({
        uniforms:{map:{value:map},soak:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
        vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader:`uniform sampler2D map;uniform float soak;varying vec2 vUv;
          void main(){vec4 texel=texture2D(map,vUv);if(texel.a<0.1)discard;
          float noise=fract(sin(dot(floor(vUv*48.0),vec2(12.9898,78.233)))*43758.5453);
          float blood=step(noise,soak*0.85)*step(vUv.y,0.3+soak*0.45)*step(0.001,soak);
          gl_FragColor=vec4(mix(texel.rgb,vec3(0.42,0.06,0.08),blood),texel.a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          }`
      });
      material.map=map; // Preserve the batch material's texture ownership/interface.
      return material;
    });
    this.geometry=new THREE.PlaneGeometry(1,1);this.geometry.translate(0,.5,0);
    this.pool=[];this.limit=limit;this.flips=new WeakMap();
    this.lean=new THREE.Quaternion();this.leanAxis=new THREE.Vector3(0,0,1);
  }
  update(units,camera,{gore=true}={}) {
    this.group.visible=this.enabled;if(!this.enabled)return;
    const elements=camera.matrixWorld.elements,right={x:elements[0],z:elements[2]};let count=0;
    for(const u of units) {
      if(u.dead||count>=this.limit)continue;
      let mesh=this.pool[count];
      if(!mesh) {
        mesh=new THREE.Mesh(this.geometry,this.materials[0]);mesh.frustumCulled=false;
        mesh.onBeforeRender=()=>{
          // ShaderMaterial uploads per-object uniforms even when the material is shared.
          mesh.material.uniforms.soak.value=mesh.userData.soak;
          mesh.material.uniformsNeedUpdate=true;
        };
        this.pool.push(mesh);this.group.add(mesh);
      }
      const flip=chooseSpriteFlip({x:Math.sin(u.face),z:Math.cos(u.face)},right,this.flips.get(u)??false);
      this.flips.set(u,flip);mesh.material=this.materials[u.team===0?0:1];mesh.position.set(u.x,u.y,u.z);
      mesh.quaternion.copy(camera.quaternion);
      const remaining=u.stunRemaining??0;
      mesh.quaternion.multiply(this.lean.setFromAxisAngle(this.leanAxis,remaining>0?Math.sin(remaining*28)*.13:0));
      mesh.userData.soak=gore?Math.max(0,Math.min(1,u.soak??0)):0;
      const size=.24*(u.bodyScale??1);mesh.scale.set(flip?-size:size,size,1);mesh.visible=true;count++;
    }
    for(let i=count;i<this.pool.length;i++)this.pool[i].visible=false;this.count=count;
  }
  clear(){this.group.visible=false;for(const p of this.pool)p.visible=false;this.count=0;}
  dispose(){this.geometry.dispose();for(const m of this.materials){m.map.dispose();m.dispose();}}
}
