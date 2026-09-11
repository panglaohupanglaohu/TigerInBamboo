import * as THREE from 'three';
// Preserve original node identity, material, transform and outer dimensions.
export function installTowerShell(tower) {
  const names=['highland-central-tower-foundation','highland-central-tower-lower','highland-central-tower-middle','highland-central-tower-upper','highland-central-obelisk-chamber','highland-central-lower-band-0','highland-central-lower-band-1','highland-central-middle-band-0','highland-central-upper-band-0','highland-castle-top-capture-deck'];
  const sources=names.map(n=>tower.getObjectByName(n));
  if(sources.some(n=>!n?.isMesh||!n.geometry?.parameters?.width))throw Error('Incomplete original tower shell');
  const wall=.12;let boxes=0;
  for(const source of sources){
    const {width:w,height:h,depth:d}=source.geometry.parameters;
    const specs=[[[wall,h,d],[(w-wall)/2,0,0]],[[wall,h,d],[-(w-wall)/2,0,0]],[[w-2*wall,h,wall],[0,0,-(d-wall)/2]]];
    if(source.name===names[0]){
      const bottom=3.55-source.position.y,top=6.35-source.position.y;
      const side=(w-2*wall-1.75)/2,z=(d-wall)/2;
      for(const sign of [-1,1])specs.push([[side,h,wall],[sign*(.875+side/2),0,z]]);
      specs.push([[1.75,bottom+h/2,wall],[0,(bottom-h/2)/2,z]],[[1.75,h/2-top,wall],[0,(top+h/2)/2,z]]);
    }else specs.push([[w-2*wall,h,wall],[0,0,(d-wall)/2]]);
    const positions=[],normals=[],uv=[];
    for(const [size,position] of specs){
      const indexed=new THREE.BoxGeometry(...size);const g=indexed.toNonIndexed();indexed.dispose();g.translate(...position);
      positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);uv.push(...g.attributes.uv.array);g.dispose();boxes++;
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    // Retained on the object for a reversible runtime comparison, not serialized userData.
    source.originalSolidGeometry=source.geometry;source.geometry=geometry;
    source.userData.hollowShell=true;
  }
  const portal=tower.getObjectByName('highland-central-sacred-portal');if(portal)portal.visible=false;
  tower.userData.shellReport={sections:names.length,boxes,wall,portal:[1.75,2.8],portalFloor:3.55,version:'web-shell-v1',wholeCastleCollisionVerified:false};
  return tower.userData.shellReport;
}
