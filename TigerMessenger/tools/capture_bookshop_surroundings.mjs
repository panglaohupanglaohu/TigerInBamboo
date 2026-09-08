import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '../../tools/shot/node_modules/playwright/index.mjs';

const out=new URL('../artifacts/bookshop-surroundings/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{let seed=20260908;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  await page.goto('http://127.0.0.1:8767/TigerMessenger/?autostart=1&timeOfDay=0.38',{timeout:120000});
  await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.bookshop&&document.getElementById('intro').classList.contains('hidden'),null,{timeout:120000});
  const data=await page.evaluate(()=>{
    const t=__tm,T=t.THREE,shop=t.messenger.landmarks.bookshop;
    t.scene.updateMatrixWorld(true);
    const inverse=shop.matrixWorld.clone().invert(),candidates=[];
    t.scene.traverse(n=>{if(n.userData.corridorId){const local=n.getWorldPosition(new T.Vector3()).applyMatrix4(inverse);if(Math.hypot(local.x,local.z)<=18)candidates.push({node:n,local});}});
    const trees=candidates.map(({node,local},i)=>{
      const treeInverse=node.matrixWorld.clone().invert(),surfaceGroups=new Map(),inkGroups=new Map();
      let originalMeshes=0;
      node.traverse(part=>{
        if(!part.isMesh||part.userData.isOutline)return;
        if(Array.isArray(part.material)||!part.geometry.attributes.normal)throw new Error('Unsupported source tree surface');
        originalMeshes++;
        const m=part.material,key=m.color.getHexString();
        if(!surfaceGroups.has(key))surfaceGroups.set(key,{color:m.color.toArray(),vertices:[],normals:[]});
        const surface=surfaceGroups.get(key),matrix=treeInverse.clone().multiply(part.matrixWorld),normalMatrix=new T.Matrix3().getNormalMatrix(matrix);
        const crown=m.color.getHex()!==0x3a322c,thickness=crown?.008:.011,dry=crown?.05:.07;
        if(!inkGroups.has(dry))inkGroups.set(dry,{dry,vertices:[],uv:[]});
        const ink=inkGroups.get(dry),g=part.geometry,p=g.attributes.position,n=g.attributes.normal;
        const indexes=g.index?Array.from(g.index.array):Array.from({length:p.count},(_,j)=>j);
        for(const index of indexes){
          const source=new T.Vector3().fromBufferAttribute(p,index),normal=new T.Vector3().fromBufferAttribute(n,index);
          const transformed=source.clone().applyMatrix4(matrix),nn=normal.clone().applyMatrix3(normalMatrix).normalize();
          surface.vertices.push(...transformed.toArray());surface.normals.push(...nn.toArray());
          const wave=Math.sin(source.dot(new T.Vector3(12.9898,78.233,37.719)))*43758.5453;
          const expanded=source.clone().addScaledVector(normal,thickness*(.65+.6*(wave-Math.floor(wave)))).applyMatrix4(matrix);
          ink.vertices.push(...expanded.toArray());ink.uv.push(source.x,source.y);
        }
      });
      const relative=inverse.clone().multiply(node.matrixWorld),forward=new T.Vector3(0,0,1).transformDirection(relative);
      return {id:`original-corridor-tree-${i}`,corridor:node.userData.corridorId,localPosition:local.toArray(),
        scale:node.scale.toArray(),yaw:Math.atan2(forward.x,forward.z),sourceMatrix:relative.toArray(),
        colliderRadius:.55*node.scale.x/1.6,originalMeshes,
        surfaces:[...surfaceGroups.values()],ink:[...inkGroups.values()]};
    });
    return {version:1,source:'src/world/nature.js:decorateCorridorForests + src/assets/lowPoly.js:createLowPolyTree',
      sourceWorld:'Web default playable world',seed:20260908,sourcePlanetRadius:160,nearRadius:18,
      frame:'bookshop local XZ; preserve spacing, yaw and scale; adapt up/height to native terrain',
      excluded:'unrelated scene objects, removed house/street factories, trees rejected by bookshop planting clearance',
      bookshopMatrix:shop.matrixWorld.toArray(),inkColor:[33/255,30/255,25/255],trees};
  });
  if(!data.trees.length||errors.length)throw new Error(JSON.stringify({trees:data.trees.length,errors}));
  // Quantise float export only; maximum component rounding error is 0.0000005.
  const text=JSON.stringify(data,(_,v)=>typeof v==='number'?Math.round(v*1e6)/1e6:v);
  const asset=new URL('../godot/data/bookshop-surroundings.json',import.meta.url);
  await writeFile(asset,text,{flag:'wx'});
  await page.screenshot({path:new URL('web-source.png',out).pathname,timeout:120000});
  const report={trees:data.trees.length,nearRadius:18,sha256:createHash('sha256').update(text).digest('hex'),bytes:Buffer.byteLength(text),
    meshes:data.trees.reduce((a,t)=>a+t.originalMeshes,0),surfaceTriangles:data.trees.reduce((a,t)=>a+t.surfaces.reduce((b,s)=>b+s.vertices.length/9,0),0),
    positions:data.trees.map(t=>({id:t.id,position:t.localPosition,scale:t.scale,colliderRadius:t.colliderRadius})),errors,
    sourceModelsChanged:false,sourceSceneChanged:false};
  await writeFile(new URL('web-source.json',out),JSON.stringify(report,null,2));
  console.log('BOOKSHOP_SURROUNDINGS_CAPTURE_OK',JSON.stringify(report));
}finally{await browser.close();}
