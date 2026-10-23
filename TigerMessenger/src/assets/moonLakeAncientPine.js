import * as THREE from 'three';
import { toonMat } from './toon.js';
import { mergeStaticGroup } from '../world/geometryMerge.js';

// One authored landmark, not a uniform enlargement of the surrounding garden pines.
export const ANCIENT_PINE_SITE = Object.freeze({ x: 9.3, z: 1.5, yaw: -0.36, nominalVolumeRatio: 20 });
export function createMoonLakeAncientPine() {
  const g = new THREE.Group(); g.name = 'moon-lake-ancient-sweeping-pine';
  const bark = toonMat(0x665d52), fissure = toonMat(0x453f37);
  const leaves = [toonMat(0x1e4a33), toonMat(0x2f6947), toonMat(0x4a8055)];
  let branchCount = 0, crownCount = 0;
  const V = p => new THREE.Vector3(...p);
  function limb(points, r0, r1, material = bark, segments = 24) {
    const curve = new THREE.CatmullRomCurve3(points.map(V));
    const geo = new THREE.TubeGeometry(curve, segments, 1, 8, false);
    const pos = geo.attributes.position;
    for (let i=0; i<=segments; i++) {
      const center=curve.getPointAt(i/segments);
      const r=THREE.MathUtils.lerp(r0,r1,Math.pow(i/segments,.78));
      for(let j=0;j<=8;j++) {const k=i*9+j; const v=new THREE.Vector3().fromBufferAttribute(pos,k).sub(center).multiplyScalar(r).add(center);pos.setXYZ(k,v.x,v.y,v.z);}
    }
    geo.computeVertexNormals(); const mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;g.add(mesh);branchCount++;return curve;
  }
  function crown(p,w,d,turn=0) {
    for(let j=0;j<5;j++) {
      const a=j*2.399963, mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),leaves[j%3]);
      mesh.position.set(p[0]+Math.cos(a)*w*.27,p[1]+Math.sin(j*1.8)*.12,p[2]+Math.sin(a)*d*.27);
      mesh.scale.set(w*(.43+j*.017),.24+j*.02,d*.48);mesh.rotation.y=turn+a*.2;mesh.castShadow=true;g.add(mesh);
    } crownCount++;
  }
  const trunk=[[0,0,0],[.8,1.5,.05],[1.9,3.0,.3],[1.65,4.7,.45],[.7,6.3,.25],[1.2,8.0,.0],[2.5,9.4,.35],[2.0,10.7,.55]];
  const curve=limb(trunk,.82,.13,bark,48);
  // Root flare follows local sphere sag; tips tuck below the turf.
  for(let i=0;i<7;i++){const a=i*6.283/7+.2,r=1.55+(i%3)*.24;limb([[.2,.25,0],[Math.cos(a)*r*.45,.12,Math.sin(a)*r*.45],[Math.cos(a)*r,-.035,Math.sin(a)*r]],.32,.018,bark,10);}
  const arms=[
    [[1.85,3.4,.35],[3.7,3.25,.25],[6.2,3.65,-.05],[8.0,4.35,.25]],
    [[1.3,5.3,.35],[-.8,5.0,.65],[-3.0,5.7,.8],[-4.0,6.1,1.0]],
    [[.8,6.4,.2],[2.4,6.8,-1.2],[4.4,7.0,-2.0],[5.1,7.4,-2.1]],
    [[1.3,8.1,0],[-.8,8.0,-.8],[-2.3,8.4,-1.3]],
    [[2.45,9.4,.35],[4.0,9.5,.4],[4.8,10.0,.1]],
    [[1.8,10.5,.5],[.4,11.1,.9],[-.2,11.2,1.1]]
  ];
  arms.forEach((ps,i)=>{
    limb(ps,.38-i*.044,.035,bark,24);
    const end=ps.at(-1);crown(end,i===0?2.1:1.8,1.25,i*.35);
    for(let j=1;j<ps.length-1;j++){
      const p=ps[j], sign=j%2?1:-1;
      const end2=[p[0]+.7*sign,p[1]+.45,p[2]+sign*(1.15+i*.08)];
      limb([p,[p[0]+.25*sign,p[1]+.15,p[2]+sign*.6],end2],.12,.022,bark,12);
      crown(end2,1.55,1.05,j*.8);
    }
  });
  crown([2,10.85,.55],1.9,1.35);
  // Long irregular bark seams follow the curved trunk rather than vertical decals.
  for(let j=0;j<9;j++) {
    const a=j*6.283/9, pts=[];
    for(let i=0;i<14;i++){const t=.025+i*.067,c=curve.getPointAt(t),r=THREE.MathUtils.lerp(.82,.13,Math.pow(t,.78));pts.push([c.x+Math.cos(a)*r*.99,c.y,c.z+Math.sin(a)*r*.99]);}
    limb(pts,.018,.01,fissure,28);
  }
  mergeStaticGroup(g);
  // Calibrated envelope volume against createAncientPineTree(7301), not height.
  g.scale.setScalar(Math.cbrt(20 / 16.292117635223843));
  g.userData={kind:'landmarkAncientPine',branchCount,crownCount,nominalVolumeRatio:20,site:ANCIENT_PINE_SITE};
  return g;
}
export function installMoonLakeAncientPine(lakeGroup, planetRadius=160) {
  const tree=createMoonLakeAncientPine();const {x,z,yaw}=ANCIENT_PINE_SITE;
  const y=Math.sqrt((planetRadius+.6)**2-x*x-z*z)-(planetRadius+.78);
  tree.position.set(x,y,z);tree.rotation.y=yaw;lakeGroup.add(tree);return tree;
}
