import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1000,height:700}});
 await page.route('**/pipeline-test.html',r=>r.fulfill({contentType:'text/html',body:`<script type="importmap">{"imports":{"three":"/TigerMessenger/vendor/three.module.js","three/addons/":"/TigerMessenger/vendor/jsm/"}}</script>`}));
 await page.goto('http://127.0.0.1:8767/TigerMessenger/pipeline-test.html');
 const result=await page.evaluate(async()=>{
  const T=await import('three');
  const {makeExposedFaceGeometry,makeExposedCellGeometry}=await import('/TigerMessenger/src/world/citadelTown.js');
  const {createFaceLayerGraph,createLegacyFaceLayout}=await import('/TigerMessenger/src/world/citadel/faceLayerGraph.js');
  const {validateFaceCages}=await import('/TigerMessenger/src/world/citadel/cageDeform.js');
  const grid=new Map([['0,0,0','0'],['1,0,0','0']]);
  const graph=createFaceLayerGraph(createLegacyFaceLayout(grid,{deformVertex:(x,z)=>[x+.42*z,z+.12*x]}));
  const seam=validateFaceCages(graph);if(!seam.ok)throw Error(JSON.stringify(seam));
  const bodies=graph.cells().map(({index})=>makeExposedFaceGeometry({graph,cellIndex:index,cellSize:2,cellHeight:2,gridSize:2}));
  if(bodies[0].expose.px||bodies[1].expose.nx)throw Error('Internal shared wall emitted');
  let checked=0,minDot=1,tiltedNormals=0;
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3();
  for(const body of bodies){const p=body.geometry.attributes.position,normal=body.geometry.attributes.normal;
    for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);b.sub(a);c.sub(a);const expected=b.cross(c).normalize();
      for(let k=0;k<3;k++){n.fromBufferAttribute(normal,i+k);minDot=Math.min(minDot,n.dot(expected));checked++;if(Math.abs(n.x)>.01&&Math.abs(n.z)>.01)tiltedNormals++;}
    }
  }
  if(minDot<.99999||!tiltedNormals)throw Error('Sheared wall normals do not match actual triangles');
  const foreign=createFaceLayerGraph(createLegacyFaceLayout(new Map([['0,0,0','0'],['1,0,0','1']])));
  if(makeExposedFaceGeometry({graph:foreign,cellIndex:0}).expose.px)throw Error('Color border emitted duplicate wall');
  const floating=createFaceLayerGraph(createLegacyFaceLayout(new Map([['0,2,0','0']])));
  if(!makeExposedFaceGeometry({graph:floating,cellIndex:0}).expose.ny)throw Error('Exposed underside omitted');
  // Preserve a no-cage legacy control: its authored axis normals stay intact.
  const old=makeExposedCellGeometry(2,2,{px:true,nx:true,py:true,ny:true,pz:true,nz:true},0,0);
  for(const v of old.attributes.normal.array)if(![-1,0,1].includes(v))throw Error('Legacy normals changed');
  const scene=new T.Scene();scene.background=new T.Color('#cad9df');
  const material=new T.MeshStandardMaterial({color:'#e3bf90',roughness:.9});
  bodies.forEach(body=>{const mesh=new T.Mesh(body.geometry,material);mesh.position.fromArray(body.center);scene.add(mesh);});
  scene.add(new T.HemisphereLight(0xffffff,0x567080,1));const sun=new T.DirectionalLight(0xfff4de,3);sun.position.set(5,5,8);scene.add(sun);
  const camera=new T.PerspectiveCamera(42,1000/700,.1,100);camera.position.set(7,6,9);camera.lookAt(0,1,-1);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,700);document.body.appendChild(renderer.domElement);renderer.render(scene,camera);
  return {passed:true,seam,checkedNormals:checked,minNormalDot:minDot,tiltedNormals,internalWallsSuppressed:true,foreignWallsSuppressed:true,floatingUnderside:true,legacyNormalsPreserved:true,scope:'actual production face wall shells; roofs/windows/navigation not migrated'};

 });
 await mkdir('TigerMessenger/artifacts/pipeline/townscaper-contract',{recursive:true});
 await page.screenshot({path:'TigerMessenger/artifacts/pipeline/townscaper-contract/face-body.png'});
 await writeFile('TigerMessenger/artifacts/pipeline/townscaper-contract/face-body.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await browser.close();}
