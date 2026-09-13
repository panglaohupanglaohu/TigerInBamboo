import * as THREE from 'three';
import {createCrate} from '../../assets/harbor.js';

// Reuse the original port cargo factory. One row against each flank of the
// gate leaves the waterfront lane and the gate's central apron unoccupied.
export function buildFrontHarborCargo(front,quays){
 const root=new THREE.Group();root.name='citadel-front-harbor-cargo';
 root.userData.source='src/assets/harbor.js:createCrate';front.add(root);
 const inventory=[];
 for(const [column,x]of [45.5,46.5,47.5,61.5,62.5,63.5].entries()){
  const quay=quays.find(q=>q.x===x);if(!quay)continue;
  let y=quay.y;
  for(let level=0;level<(column%3===0?3:2);level++){
   const crate=createCrate({wood:true,size:.66-level*.06,seed:9300+column*7+level});
   crate.name=`front-port-cargo-${column}-${level}`;
   crate.position.set(x,y,108.35);crate.rotation.y=level%2?Math.PI/2:0;
   crate.userData.citadelSolidExterior=true;
   root.add(crate);y+=crate.userData.size.y;
   inventory.push({id:crate.name,column,level,x,z:108.35,baseY:crate.position.y,size:crate.userData.size});
  }
 }
 root.userData.inventory=inventory;
 root.userData.unloadingConnected=false;
 root.userData.reservedGateX=[50.5,57.5];
 root.userData.reservedWaterfrontZ=[109,110.2];
 front.userData.cargoStaging={root:root.name,inventory:inventory.map(c=>c.id),unloadingConnected:false,reason:'Original logistics transfer awaits validated ship-to-quay connector'};
 return root;
}
