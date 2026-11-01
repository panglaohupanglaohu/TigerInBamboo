import * as THREE from 'three';
import {applySwampCoralWeathering} from './swampCoralWeathering.js';

// Own only the exterior geology. All top anchors are supplied by the actual
// installed rim, and this decoration is never registered as a walk surface.
export function createSwampCoralOuterCliff(outer){
  if(!Array.isArray(outer)||outer.length<3)return null;
  const group=new THREE.Group();group.name='greg-coral-outer-cliff';
  const position=[],color=[],lines=[],lineColors=[],rings=[],backs=[],depths=[];
  const rock=[0x829293,0x73868c,0x8c9b99,0x71818b].map(c=>new THREE.Color(c)),soil=new THREE.Color(0xd98d86),ink=new THREE.Color(0x575e6c),root=new THREE.Color(0x877e89);
  const tri=(a,b,c,tint)=>{for(const v of [a,b,c]){position.push(v.x,v.y,v.z);color.push(tint.r,tint.g,tint.b);}};
  const quad=(a,b,c,d,tint)=>{tri(a,b,c,tint);tri(a,c,d,tint);};
  const at=(p,r,y)=>new THREE.Vector3(p.x,p.y,p.z).setY(0).normalize().multiplyScalar(r).setY(y);
  // Low-frequency ledges with uneven column boundaries; no runtime randomness.
  let column=0,next=0;const columnAt=[];
  for(let i=0;i<outer.length;i++){
    if(i>=next){column++;next=i+3+(column*7%4);}columnAt.push(column);
    const p=outer[i],r=Math.hypot(p.x,p.z),a=Math.atan2(p.z,p.x);
    const depth=8.5+1.25*Math.sin(a*5+.8)+.65*Math.sin(a*13)+.3*Math.sin(column*2.4),ledge=.12+.18*Math.sin(a*9+.3);
    const ys=[p.y,p.y-.42,p.y-2.7-.22*Math.sin(a*6),p.y-depth*.67,p.y-depth];
    const radii=[r,r+.035,r+.12+ledge+.22*Math.sin(column*2.4),r+.03+.18*Math.sin(a*7)+.3*Math.sin(column*2.4),r-.65-.15*Math.sin(a*11)];
    rings.push(ys.map((y,j)=>at(p,radii[j],y)));
    backs.push([at(p,r-1.45,p.y-.025),at(p,r-1.45,p.y-depth+.12)]);depths.push(depth);
  }
  for(let i=0;i<outer.length-1;i++){
    for(let j=0;j<4;j++)quad(rings[i][j],rings[i+1][j],rings[i+1][j+1],rings[i][j+1],j===0?soil:rock[(columnAt[i]+j)%rock.length]);
    // Hidden back and bottom close the physical section under the existing top.
    quad(backs[i][0],backs[i][1],backs[i+1][1],backs[i+1][0],rock[1]);
    quad(rings[i][4],rings[i+1][4],backs[i+1][1],backs[i][1],rock[1]);
    quad(rings[i][0],backs[i][0],backs[i+1][0],rings[i+1][0],soil);
  }
  for(const i of [0,outer.length-1]){
    for(let j=0;j<4;j++)tri(backs[i][0],rings[i][j],rings[i][j+1],rock[1]);
    tri(backs[i][0],rings[i][4],backs[i][1],rock[1]);
  }
  const line=(a,b,tint)=>{for(const p of [a,b]){const outward=new THREE.Vector3(p.x,0,p.z).normalize().multiplyScalar(.009);lines.push(p.x+outward.x,p.y,p.z+outward.z);lineColors.push(tint.r,tint.g,tint.b);}};
  let cracks=0,roots=0;
  for(let i=2;i<outer.length-2;i++){
    if(columnAt[i]!==columnAt[i-1]){
      const end=columnAt[i]%3===0?4:3;
      for(let j=1;j<end;j++)line(rings[i][j],rings[i][j+1],ink);cracks++;
    }
    if(i%29===13){
      // Short exposed roots cling to the section; they never cross the top path.
      const end=rings[i][1].clone().lerp(rings[i][2],.52);
      line(rings[i][0],rings[i][1],root);line(rings[i][1],end,root);roots++;
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(color,3));geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false,fog:false}));applySwampCoralWeathering(mesh.material,{exterior:true});mesh.name='greg-coral-outer-cliff-rock';mesh.userData.gregExteriorOnly=true;mesh.raycast=()=>{};group.add(mesh);
  const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));lineGeo.setAttribute('color',new THREE.Float32BufferAttribute(lineColors,3));
  const strokes=new THREE.LineSegments(lineGeo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.67,toneMapped:false,fog:false}));strokes.name='greg-coral-outer-cliff-seams';strokes.raycast=()=>{};group.add(strokes);
  const report={version:2,renderDraws:2,cracks,roots,depthInner:[Math.min(...depths),Math.max(...depths)],topAnchors:outer.map(p=>p.toArray()),walkable:false,entrance:'same angular endpoints as existing rim',triangles:position.length/9};
  group.userData.coralOuterCliff=report;
  return {group,report,dispose(){group.removeFromParent();geo.dispose();mesh.material.dispose();lineGeo.dispose();strokes.material.dispose();}};
}
