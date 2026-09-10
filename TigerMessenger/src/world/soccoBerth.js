import * as THREE from 'three';

// Radial terrain hits only: no foot offset, ocean, VFX or vehicle surfaces.
export function createSoccoBerthSolver(scene, seaRadius) {
  const terrain=[];
  scene.traverse(o=>{
    const n=o.name||'',p=o.parent?.name||'';
    if(o.isMesh&&(n==='planet-surface'||n==='mossy-terrain'||n==='leviathan-crust-plate'||n==='leviathan-terrain-topography'||n.startsWith('leviathan-moss-bed')||p==='mossyGround'))terrain.push(o);
  });
  const ray=new THREE.Raycaster(),Y=new THREE.Vector3(0,1,0);
  // Keep authored stones and trees in place. Test their individual mesh bounds,
  // not one giant group bound spanning the entire garden.
  function obstacleMeshes() {
    const meshes=[];
    scene.traverse(o=>{
      if(!o.isMesh||o.parent?.isMesh)return;
      let prop=false;
      for(let p=o;p;p=p.parent){
        if(!p.visible)return;
        if((p.userData.kind||'').startsWith('gardenStone:')||/giantTreeGroup|giantBanyanGroup|saihoji-scree-rocks/.test(p.name||''))prop=true;
      }
      if(prop){o.geometry.computeBoundingBox();meshes.push(o);}
    });
    return meshes;
  }
  function blocked(matrix, angle, meshes) {
    const inverse=matrix.clone().invert();
    const hull=new THREE.Box3(new THREE.Vector3(-1.45,-1.95,-2.65),new THREE.Vector3(1.45,1.1,2.4));
    const exit=new THREE.Box3(new THREE.Vector3(-.95,-1.45+2.9*Math.sin(angle),-7.5),new THREE.Vector3(.95,.65,-2.65));
    for(const mesh of meshes){
      const transform=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
      const box=mesh.geometry.boundingBox.clone().applyMatrix4(transform);
      if(!box.intersectsBox(hull)&&!box.intersectsBox(exit))continue;
      const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
      const triangle=new THREE.Triangle();
      for(let i=0;i<(index?index.count:p.count);i+=3){
        triangle.a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(transform);
        triangle.b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(transform);
        triangle.c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(transform);
        if(hull.intersectsTriangle(triangle)||exit.intersectsTriangle(triangle))return true;
      }
    }
    return false;
  }
  function sample(point) {
    const direction=point.clone().normalize();
    ray.set(direction.clone().multiplyScalar(seaRadius+50),direction.clone().negate());
    ray.far=85;
    const hit=ray.intersectObjects(terrain,false).find(h=>{
      for(let o=h.object;o;o=o.parent){if(!o.visible)return false;if(o===scene)return true;}
      return false;
    });
    return hit&&hit.point.length()>seaRadius+.075?hit.point.clone():null;
  }
  function solve(craft, beach, inland, used=[]) {
    scene.updateMatrixWorld(true);
    const obstacles=obstacleMeshes();
    const up=beach.clone().normalize(),east=Y.clone().cross(up).normalize();
    if(east.lengthSq()<.01)east.set(1,0,0);
    const north=up.clone().cross(east).normalize(),base=up.clone().multiplyScalar(seaRadius);
    const offsets=[];
    for(let x=-14;x<=14;x+=2)for(let z=-14;z<=14;z+=2)offsets.push([x,z]);
    const inlandOffset=inland.clone().normalize().multiplyScalar(seaRadius).sub(base);
    for(let x=-24;x<=24;x+=2)for(let z=-24;z<=24;z+=2)offsets.push([inlandOffset.dot(east)+x,inlandOffset.dot(north)+z]);
    offsets.sort((a,b)=>a[0]*a[0]+a[1]*a[1]-b[0]*b[0]-b[1]*b[1]);
    let attempts=0;
    for(const [x,z] of offsets) {
      const ground=sample(base.clone().addScaledVector(east,x).addScaledVector(north,z));
      if(!ground||used.some(p=>p.distanceTo(ground)<7))continue;
      for(const heading of [0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI]) {
      attempts++;
      const normal=ground.clone().normalize();
      const toward=inland.clone().multiplyScalar(seaRadius).sub(ground).projectOnPlane(normal).normalize();
      if(toward.lengthSq()<.1)toward.copy(north);
      toward.applyAxisAngle(normal,heading);
      const forward=toward.negate(),right=normal.clone().cross(forward).normalize();
      const quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,normal,forward));
      const position=ground.clone().addScaledVector(normal,2.02*craft.scale.y);
      let matrix=new THREE.Matrix4().compose(position,quaternion,craft.scale),inverse=matrix.clone().invert();
      let lift=0,valid=true;
      for(const sx of [-1.3,0,1.3])for(const sz of [-2.7,-1.5,0,1.5,2.3]) {
        const hit=sample(new THREE.Vector3(sx,-2,sz).applyMatrix4(matrix));
        if(hit)lift=Math.max(lift,hit.applyMatrix4(inverse).y+2.02);
      }
      position.addScaledVector(normal,lift*craft.scale.y);
      matrix.compose(position,quaternion,craft.scale);inverse.copy(matrix).invert();
      let angle=0,localY=NaN;
      const tip=a=>new THREE.Vector3(0,-1.4+2.9*Math.sin(a)-.01*Math.cos(a),-2.62-2.9*Math.cos(a)-.01*Math.sin(a));
      for(let i=0;i<5;i++) {
        const hit=sample(tip(angle).applyMatrix4(matrix));
        if(!hit){valid=false;break;}
        localY=hit.applyMatrix4(inverse).y;
        const ratio=(localY+1.4)/Math.hypot(2.9,.01);
        if(Math.abs(ratio)>1){valid=false;break;}
        angle=Math.asin(ratio)+Math.atan(.01/2.9);
        if(Math.abs(angle)>25*Math.PI/180){valid=false;break;}
      }
      if(!valid)continue;
      for(const lane of [-.65,0,.65]) {
        for(let i=1;i<15;i++) {
          const d=2.9*i/15,point=new THREE.Vector3(lane,-1.4+d*Math.sin(angle),-2.62-d*Math.cos(angle)).applyMatrix4(matrix);
          const hit=sample(point);
          if(hit&&hit.applyMatrix4(inverse).y>new THREE.Vector3().copy(point).applyMatrix4(inverse).y-.012)valid=false;
        }
        for(const extra of [0,.5,1]) {
          const end=tip(angle);end.x=lane;end.z-=extra;
          const hit=sample(end.clone().applyMatrix4(matrix));
          if(!hit||Math.abs(hit.applyMatrix4(inverse).y-end.y)>(extra===0?.08:.35))valid=false;
        }
      }
      if(valid&&!blocked(matrix,angle,obstacles))return {valid:true,position,quaternion,groundLocalY:localY,angle,attempts,ground,obstacleMeshes:obstacles.length,scope:'Dry supported ramp plus tree/stone triangle intersection for hull and rear exit volumes; not the complete infantry route'};
      }
    }
    return {valid:false,attempts,reason:'No dry supported rear-ramp berth near original beach'};
  }
  return {solve,sample,obstacleMeshes,terrainCount:terrain.length};
}
