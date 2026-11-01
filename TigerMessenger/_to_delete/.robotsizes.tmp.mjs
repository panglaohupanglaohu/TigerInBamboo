const ctx={fillRect(){},createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),fillText(){},strokeText(){},measureText:()=>({width:1}),beginPath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},closePath(){},save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(){},rect(){},clip(){},setTransform(){},getImageData:()=>({data:new Uint8ClampedArray(4)}),putImageData(){}};
globalThis.document={createElement:()=>({getContext:()=>ctx,width:0,height:0,style:{}}),getElementById:()=>null,addEventListener(){}};
globalThis.window=globalThis;
const T=await import('three');
const {BOOKSHOP_ROBOT_FACTORIES}=await import('../src/assets/bookshopRobots.js');
for(const [i,f] of BOOKSHOP_ROBOT_FACTORIES.entries()){
 const m=f({rigged:true});m.scale.setScalar(1.25);m.updateMatrixWorld(true);
 const radii=[];let cast=0;
 m.traverse(o=>{if(!o.isMesh)return;if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();const s=new T.Vector3();o.matrixWorld.decompose(new T.Vector3(),new T.Quaternion(),s);const r=o.geometry.boundingSphere.radius*Math.max(s.x,s.y,s.z);radii.push(r);if(o.castShadow)cast++;});
 radii.sort((a,b)=>a-b);const q=p=>radii[Math.floor(p*(radii.length-1))].toFixed(2);
 const under=t=>radii.filter(r=>r<t).length;
 console.log(i,'meshes',radii.length,'cast',cast,'p25',q(.25),'p50',q(.5),'p75',q(.75),'max',q(1),'<.15',under(.15),'<.25',under(.25),'<.35',under(.35));
}
