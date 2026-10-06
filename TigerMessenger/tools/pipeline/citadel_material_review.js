import treeData from '../../assets/models/optimized/citadel-cypress/citadelCypressData.js';
const frame=document.querySelector('#stage'),nav=document.querySelector('nav');
let selected='statue';
const context=()=>{const t=frame.contentWindow.__tm;return {t,T:t.THREE,c:t.scene.getObjectByName('castleContainer')};};
function focus(kind){
 const {t,T,c}=context();selected=kind;c.updateWorldMatrix(true,true);
 const target=c.getObjectByName(kind==='statue'?'citadel-plaza-hero-statue':'citadel-terrace-garden');
 if(!target)throw new Error('Missing actual material target '+kind);
 const box=new T.Box3();
 if(kind==='tree'){
  let leaf;target.traverse(o=>{if(o.isMesh&&o.material?.name==='citadel-cypress-deep')leaf=o;});
  if(!leaf)throw new Error('Missing actual cypress deep surface');
  const pos=leaf.geometry.attributes.position,first=treeData.parts.find(p=>p.material===0),count=first.index.length;
  // The seventh authored tree stands beside the open plaza; the first tree is
  // behind a retaining wall and cannot be reviewed from the seaward camera.
  const start=6*count;
  for(let i=start;i<Math.min(start+count,pos.count);i++)box.expandByPoint(new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(leaf.matrixWorld));
 }else box.setFromObject(target);
 const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),up=new T.Vector3(0,1,0).transformDirection(c.matrixWorld),front=new T.Vector3(.45,.12,1).transformDirection(c.matrixWorld);
 const distance=Math.max(8,size.length()*1.65);t.camera.position.copy(center).addScaledVector(front,distance).addScaledVector(up,size.length()*.08);t.camera.up.copy(up);t.camera.lookAt(center);t.camera.fov=42;t.camera.zoom=1;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);t.distanceCulling?.recollect();t.distanceCulling?.update(3);t.renderer.render(t.scene,t.camera);
 document.querySelector('#material-status').textContent=(kind==='tree'?'实际台地柏树':'实际广场雕像')+' · 已对准；原城墙作背景';audit();
}
function audit(){
 const {t,c}=context(),rows=[];let walls=0;
 for(const name of ['citadel-terrace-garden','citadel-plaza-hero-statue'])c.getObjectByName(name)?.traverse(o=>{if(!o.isMesh||o.userData.isOutline)return;for(const m of Array.isArray(o.material)?o.material:[o.material])rows.push({group:name,mesh:o.name,material:m.name,color:m.color?.toArray(),roughness:m.roughness,metalness:m.metalness,historic:!!m.userData.historicStone,cityColour:m.userData.cityColourStudy||null,preserved:!!m.userData.preserveCitadelMaterial||!!o.parent?.userData.preserveCitadelMaterials});});
 c.traverse(o=>{if(o.isMesh&&!o.userData.isOutline&&(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.userData.historicStone))walls++;});
 const gl=t.renderer.getContext(),errors=[];for(let i=0;i<16;i++){const e=gl.getError();if(!e)break;errors.push(e);}
 const programs=t.renderer.info.programs.map(p=>({name:p.name,linked:gl.getProgramParameter(p.program,gl.LINK_STATUS),shaders:(gl.getAttachedShaders(p.program)||[]).map(s=>gl.getShaderParameter(s,gl.COMPILE_STATUS))}));
 const report={at:new Date().toISOString(),selected,rows,wallsWithHistoricFinish:walls,violations:rows.filter(r=>r.historic||r.cityColour),gpu:{programs,glErrors:errors},note:'Actual loaded game meshes; review uses fixed daylight/Moebius isolation from mountain harness; no persistence.'};
 document.querySelector('#material-results').textContent=JSON.stringify(report,null,2);return report;
}
function save(data,name){const a=document.createElement('a');a.href=data;a.download=name;a.click();}
for(const [id,label,action]of [['material-tree','检查柏树',()=>focus('tree')],['material-statue','检查雕像',()=>focus('statue')],['material-export','导出材质证据',()=>{const report=audit();const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));save(url,'citadel-material-'+selected+'.json');setTimeout(()=>URL.revokeObjectURL(url),1000);}],['material-png','导出近景',()=>{const {t}=context();t.renderer.render(t.scene,t.camera);save(t.renderer.domElement.toDataURL('image/png'),'citadel-material-'+selected+'.png');}]]){const b=document.createElement('button');b.id=id;b.textContent=label;b.disabled=true;b.onclick=action;nav.append(b);}
const status=document.createElement('p');status.id='material-status';status.textContent='等待实际场景';nav.after(status);
const pre=document.createElement('pre');pre.id='material-results';document.body.append(pre);
