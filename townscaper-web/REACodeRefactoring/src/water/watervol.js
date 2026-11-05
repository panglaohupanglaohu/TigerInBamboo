/**
 * watervol.js — 一摞采样 SDF 的平面做出的"有体积"的浅水（第三个项目）。
 *
 * 依据：1758251637280268481 "It's simply a stack of planes sampling an SDF I had laying around. Gives a much more fluid vibe
 *   than the basic flipped mesh approach in Bad North and Townscaper"
 *   画面：镜头降低至水面，线框与反射随视角变化；SDF维度未给出。本地同心浅水线只是近似。
 *
 * 做法：
 *   1. 2D 海岸中心距离场：192²采样level1实心，用各向异性精确中心EDT；不是原片3D SDF。
 *   2. N 张水平面，叠在海面上方极小的高度上（第 i 张代表"水下 i 层"），每张只画距离 < 阈值 i 的那一圈，
 *      颜色从浅青到海色，半透明；阈值随时间和噪声轻微起伏 → 一圈套一圈、会流动的浅水。
 *   我们的海面是不透明的，所以平面叠在水面之上而不是之下；这是本地浅滩近似，不证明与原片SDF反射等价。
 */

import * as THREE from 'three';
import {waterDistance} from './land-distance.js';

export class WaterVolume {
  constructor({ scene, uTime, layers = 6 }) {
    if(!Number.isInteger(layers)||layers<2||layers>32)throw new RangeError('water layers');
    this.uTime = uTime;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.layers = layers;
    this.tex = null;
    this.mats = [];
  }

  set visible(on) { this.group.visible = on; }

  refresh(world, index) {
    if(this.world===world&&this.version===world.version)return;
    const field=waterDistance(world,index);
    this.clearResources();this.world=world;this.version=world.version;this.field=field;
    if(!field)return;
    const {R,minX,minZ,width,depth,distance,land,maxDistance}=field;
    const data=new Uint8Array(R*R*4);
    for(let i=0;i<R*R;i++){data[i*4]=Math.round(distance[i]/maxDistance*255);data[i*4+3]=land[i]?0:255;}
    this.tex=new THREE.DataTexture(data,R,R,THREE.RGBAFormat);
    this.tex.magFilter=this.tex.minFilter=THREE.LinearFilter;this.tex.needsUpdate=true;
    const maxX=minX+width,maxZ=minZ+depth;
    const geo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ).rotateX(-Math.PI / 2).translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    for (let i = 0; i < this.layers; i++) {
      const t = i / (this.layers - 1);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uSdf: { value: this.tex }, uTime: this.uTime, uLimit: { value: 0.25 + t * 1.6 }, uCol: { value: new THREE.Color().lerpColors(new THREE.Color('#bfe6e0'), new THREE.Color('#2f6c78'), t) }, uLayer: { value: i }, uBox: { value: new THREE.Vector4(minX, minZ, maxX - minX, maxZ - minZ) } },
        vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: /* glsl */ `
          uniform sampler2D uSdf; uniform float uTime; uniform float uLimit; uniform vec3 uCol; uniform float uLayer; uniform vec4 uBox;
          varying vec3 vW;
          void main() {
            vec2 uv = (vW.xz - uBox.xy) / uBox.zw;
            vec4 field = texture2D(uSdf, uv);
            if(field.a<0.5)discard;
            float d = field.r * 4.0;                 // 到最近陆地的距离（世界单位）
            float wob = sin(vW.x * 1.7 + uTime * 0.6 + uLayer) * 0.06 + sin(vW.z * 2.3 - uTime * 0.45 + uLayer * 1.3) * 0.05;
            float edge = uLimit + wob;
            if (d <= 0.02 || d > edge) discard;
            float a = 0.2 * (1.0 - smoothstep(edge - 0.25, edge, d));
            float rim = 1.0 - smoothstep(0.0, 0.035, edge - d);           // 每层边缘一道亮线 = "等高线"
            gl_FragColor = vec4(mix(uCol, vec3(1.0), rim * 0.7), max(a, rim * 0.45));
            #include <colorspace_fragment>
          }`,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.y = 0.004 + i * 0.0015;
      m.renderOrder = 2.5;   // 在岸边光晕（skirt，2）之后、浪（3）之前
      this.group.add(m);
      this.mats.push(mat);
    }
  }
  clearResources(){
    const geos=new Set(),mats=new Set();for(const m of this.group.children){geos.add(m.geometry);mats.add(m.material)}
    this.group.clear();for(const g of geos)g.dispose();for(const m of mats)m.dispose();this.tex?.dispose();this.tex=null;this.mats=[];
  }
  dispose(){this.clearResources();this.group.removeFromParent();this.world=null;this.version=-1;this.field=null;}

}
