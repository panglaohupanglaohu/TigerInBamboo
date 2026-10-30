import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
/** Courier-style authored loft GLB. Legacy geometry is kept for reversible fallback. */
export async function upgradeMorrisPrincessAsset(root,{url=new URL('../../assets/models/morris-princess/princess-v17-mounted.glb',import.meta.url).href,loader=new GLTFLoader()}={}){
 if(root.userData.princessAsset)return root.userData.princessAsset;
 const gltf=await loader.loadAsync(url),model=gltf.scene.getObjectByName('MorrisPrincess')||gltf.scene;
 const nodes=Object.fromEntries(['body','head','cape','armL','armR'].map(n=>[n,model.getObjectByName(n)]));
 for(const[n,o]of Object.entries(nodes))if(!o)throw new Error(`Princess authored pivot missing: ${n}`);
 const previous=root.userData.princess,visibility=[];for(const c of root.children){visibility.push([c,c.visible]);c.visible=false;}
 model.name='morris-princess-authored-asset';model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});root.add(model);
 root.userData.princess={...previous,torso:nodes.body,head:nodes.head,cape:nodes.cape,arms:[nodes.armL,nodes.armR],revision:model.userData.revision||'reference-rebuilt-v17',rigType:'authored empty pivots, no skinning'};
 const asset={model,nodes,previous,status:'candidate-game-review-pending',restore(){root.remove(model);for(const[o,v]of visibility)o.visible=v;root.userData.princess=previous;delete root.userData.princessAsset;}};
 root.userData.princessAsset=asset;return asset;
}
