import {createTargetCityEntityEditor} from '../../src/world/citadel/targetCityEntityEditor.js';
import {TARGET_OLD_CITY_ROOF_ROLES} from '../../src/world/citadel/targetOldCityRoofWfc.js';
/** Candidate-only UI. Root owns a roof session; only legacy editors belong to this panel. */
export function installTargetCityEditorPanel({root,scene,camera,canvas,THREE,host,refresh,onReport=()=>{},targetId,terrainVersion,factoryVersion}){
 const session=root.userData.candidateHandle?.openRoofSession?.({targetId,terrainVersion,factoryVersion})??null;
 const editor=session??createTargetCityEntityEditor({root,targetId,terrainVersion,factoryVersion});
 const doc=canvas.ownerDocument,panel=doc.createElement('section');panel.id='target-entity-editor';panel.style.cssText='padding:10px;border:1px solid #628d98;background:#213c46;color:#eef8f4;display:flex;flex-wrap:wrap;gap:8px;align-items:center';
 const title=doc.createElement('strong');title.textContent='旧城住宅候选编辑';panel.append(title);
 const active=doc.createElement('input');active.type='checkbox';active.id='entity-pointer-active';const enabled=doc.createElement('label');enabled.append(active,doc.createTextNode('启用点选 / 右键删除'));panel.append(enabled);
 const select=doc.createElement('select');select.setAttribute('aria-label','候选住宅');panel.append(select);
 const colour=doc.createElement('input');colour.type='color';colour.setAttribute('aria-label','住宅墙色');panel.append(colour);
 const message=doc.createElement('span');message.id='entity-edit-status';panel.append(message);
 const text=doc.createElement('textarea');text.setAttribute('aria-label','候选编辑JSON');text.style.cssText='display:none;width:100%;min-height:90px';
 let pointer=null,lastResult=null,lastSolver=null,disposed=false,shadowProbe=false,locks={...session?.solverProvenance?.locks};
 const events=[],shadowOriginal=new WeakMap(),shadowTouched=new Set();
 let roleSelect=null,seedInput=null,recompute=null,roofStatus=null;
 function listen(target,name,fn,options){target.addEventListener(name,fn,options);events.push(()=>target.removeEventListener(name,fn,options));}
 function selected(){return editor.list().find(e=>e.id===select.value);}
 function syncSelection(){const row=selected();if(row)colour.value=row.wallColor;if(roleSelect){roleSelect.value=locks[select.value]??'';roleSelect.disabled=!row?.occupied;}}
 function report(){return{mode:editor.mode,wfc:session?.roofConstraintStatus.source==='wfc',scope:session?'旧城15个固定地块的五种屋顶角色；住宅占用与墙色；不支持新增地块/楼层或全城WFC':'旧城15栋住宅占用与墙色；未接屋顶求解',size:editor.size,revision:editor.revision,history:editor.history,roofHistory:session?.roofHistory??null,roofConstraintStatus:session?.roofConstraintStatus??null,solverProvenance:session?.solverProvenance??null,solverReport:lastSolver,solverReportScope:'last solve attempt; current verified source is solverProvenance',pendingRoofLocks:{...locks},recomputeAfterOccupancy:recompute?.checked??false,lastResult,snapshot:editor.exportSnapshot(),pointerEditing:active.checked,productionEditorInstalled:false,diagnosticShadowReceptionDisabled:shadowProbe};}
 function sync(result){
  if(result)lastResult=result;if(result?.solver)lastSolver=result.solver;else if(result?.ok&&result.operation)lastSolver=null;
  const old=select.value,rows=editor.list();select.replaceChildren();for(const row of rows){const opt=doc.createElement('option');opt.value=row.id;opt.textContent=row.id+(row.occupied?'':' · 空槽');select.append(opt);}if(rows.some(e=>e.id===old))select.value=old;syncSelection();
  message.textContent=result?(result.ok?'已应用候选编辑':'未应用：'+result.error):'15栋住宅；地标、台地及通道受保护。';
  if(session){const state=session.roofConstraintStatus;recompute.disabled=state.source!=='wfc';if(recompute.disabled)recompute.checked=false;roofStatus.textContent=state.source==='wfc'?(state.occupancyMatchesSolve?'有限屋顶WFC：当前占用已求解。':'有限屋顶WFC：占用已变化，需要重算。'):'作者屋顶方案：尚未运行WFC。';}
  onReport(report());
 }
 function markMaterial(mesh){for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(m)m.needsUpdate=true;}
 function restoreShadows(){for(const mesh of shadowTouched){if(shadowOriginal.has(mesh)){mesh.receiveShadow=shadowOriginal.get(mesh);markMaterial(mesh);}}shadowTouched.clear();shadowProbe=false;}
 function perform(fn,{syncLocks=false}={}){
  if(disposed)return;const previous=session?.currentAsset;
  try{const result=fn();if(result.ok){if(session?.currentAsset!==previous&&shadowProbe)restoreShadows();if(syncLocks&&session)locks={...session.solverProvenance?.locks};}sync(result);if(result.ok)refresh();return result;}catch(e){const result={ok:false,error:String(e.message||e)};sync(result);return result;}
 }
 function button(label,fn){const b=doc.createElement('button');b.textContent=label;listen(b,'click',fn);panel.append(b);return b;}
 function solveOptions(){const seed=Number(seedInput.value);if(seedInput.value.trim()===''||!Number.isSafeInteger(seed))throw new Error('种子必须是整数');return{seed,locks:{...locks},domains:session.solverProvenance?.domains??{},maxBacktrack:session.solverProvenance?.maxBacktrack??32};}
 function occupancy(id,occupied){return perform(()=>recompute?.checked?session.editAndSolve({id,occupied},solveOptions()):editor.edit({id,occupied}),{syncLocks:!!recompute?.checked});}
 button('候选受影开关诊断',()=>{
  if(shadowProbe)restoreShadows();else{root.traverse(o=>{if(o.isMesh){shadowOriginal.set(o,o.receiveShadow);shadowTouched.add(o);o.receiveShadow=false;markMaterial(o);}});shadowProbe=true;}
  message.textContent=shadowProbe?'诊断：关闭候选受影，非交付光照。':'已恢复候选受影。';refresh();onReport(report());
 });
 button('删除所选住宅',()=>occupancy(select.value,false));button('恢复所选住宅',()=>occupancy(select.value,true));
 button('应用墙色',()=>perform(()=>editor.edit({id:select.value,wallColor:colour.value})));
 button('住宅撤销',()=>perform(()=>editor.undo()));button('住宅重做',()=>perform(()=>editor.redo()));
 if(session){
  roleSelect=doc.createElement('select');roleSelect.setAttribute('aria-label','所选住宅屋顶锁定');const names={'hip-roof':'橙瓦坡顶','open-terrace-pavilion':'开放露台小亭','setback-upper-room':'退台上层房','outer-edge-short-tower':'短塔','upper-street-cupola':'街侧小穹塔'};
  for(const role of ['',...TARGET_OLD_CITY_ROOF_ROLES]){const option=doc.createElement('option');option.value=role;option.textContent=role?'锁定：'+names[role]:'屋顶不锁定';roleSelect.append(option);}panel.append(roleSelect);
  listen(roleSelect,'change',()=>{if(roleSelect.value)locks[select.value]=roleSelect.value;else delete locks[select.value];message.textContent='屋顶锁定待求解应用；未改变场景。';onReport(report());});
  seedInput=doc.createElement('input');seedInput.type='number';seedInput.step='1';seedInput.value=String(session.solverProvenance?.seed??20261006);seedInput.setAttribute('aria-label','屋顶求解种子');seedInput.style.width='105px';panel.append(seedInput);
  button('求解并应用屋顶',()=>perform(()=>session.solve(solveOptions()),{syncLocks:true}));
  button('屋顶撤销',()=>perform(()=>session.undoRoof(),{syncLocks:true}));button('屋顶重做',()=>perform(()=>session.redoRoof(),{syncLocks:true}));
  recompute=doc.createElement('input');recompute.type='checkbox';recompute.checked=false;recompute.disabled=session.roofConstraintStatus.source!=='wfc';recompute.setAttribute('aria-label','增删后重算屋顶');const label=doc.createElement('label');label.append(recompute,doc.createTextNode('增删后重算屋顶'));panel.append(label);listen(recompute,'change',()=>onReport(report()));
  roofStatus=doc.createElement('span');roofStatus.id='roof-constraint-status';panel.append(roofStatus);
 }
 button('导出候选编辑JSON',()=>{text.style.display='block';text.value=editor.exportJSON();const url=URL.createObjectURL(new Blob([text.value],{type:'application/json'}));const a=doc.createElement('a');a.href=url;a.download=session?'citadel-target-roof-session.json':'citadel-target-entity-edit.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);message.textContent='已导出独立候选文件；未改原游戏存档。';});
 button('载入候选编辑JSON',()=>{text.style.display='block';if(!text.value){text.value=editor.exportJSON();message.textContent='可粘贴同版本候选JSON后再次载入。';return;}const result=perform(()=>editor.importSnapshot(text.value),{syncLocks:true});if(result?.ok&&session)seedInput.value=String(session.solverProvenance?.seed??20261006);});
 listen(select,'change',syncSelection);listen(active,'change',()=>{pointer=null;message.textContent=active.checked?'左键点选住宅，右键短点删除；拖拽不会删除。':'点选编辑已关闭。';onReport(report());});
 panel.append(text);host.append(panel);sync();const win=doc.defaultView;
 listen(win,'pointerdown',e=>{if(!active.checked||e.target!==canvas)return;pointer={x:e.clientX,y:e.clientY,button:e.button,id:e.pointerId};if(e.button===2){e.preventDefault();e.stopImmediatePropagation();}},true);
 listen(win,'contextmenu',e=>{if(active.checked&&e.target===canvas){e.preventDefault();e.stopImmediatePropagation();}},true);
 listen(win,'pointerup',e=>{if(!active.checked||e.target!==canvas||!pointer)return;const down=pointer;pointer=null;if(down.button===2){e.preventDefault();e.stopImmediatePropagation();}if(down.id!==e.pointerId||Math.hypot(down.x-e.clientX,down.y-e.clientY)>6)return;
  const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.layers.enableAll();camera.updateMatrixWorld(true);ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);const pick=editor.intersectClosestVisible(ray,scene);
  if(pick?.kind==='entity'){select.value=pick.id;syncSelection();if(down.button===2)occupancy(pick.id,false);else{message.textContent='已选中 '+pick.id;onReport(report());}}
  else{message.textContent=pick?'当前表面受保护，未点穿到后方住宅。':'未选中住宅。';onReport(report());}
 },true);
 return{editor,session,report,dispose(){if(disposed)return;disposed=true;events.forEach(f=>f());restoreShadows();if(!session)editor.dispose();panel.remove();}};
}
