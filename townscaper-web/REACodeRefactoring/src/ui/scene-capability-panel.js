/** Current-View controls only. A checked box reflects live state, not a learning status. */
export const SCENE_CONTROL_GROUPS=[
 ['水与生命',[
  ['reflection','水面倒影',v=>v.reflection?.visible],['shorelines','岸线轮廓',v=>v.shoreLine?.visible&&v.seaLine?.visible],['watervol','体积浅水',v=>v.waterVol?.group.visible],
  ['vegetation','植被总开关',v=>v.vegetation?.group.visible],...['grass','shrubs','trees','flowers'].map((k,i)=>[k,['草','灌木','树','花'][i],v=>v.vegetation?.layers[k]]),
  ['leafy','叶片材质',v=>v.vegetation?.leafy],['impostor','树冠图集替身',v=>v.vegetation?.impostorOn],['boats','船与航迹',v=>v.boats?.group.visible],['lighthouse','灯塔灯室',v=>v.lighthouses?.group.visible],['wires','屋间衣绳',v=>v.decor?.wires.visible],['fire','现有火源',v=>v.effects?.fire.visible],['sound','环境与交互音效',v=>v.sound?.enabled]
 ]],
 ['地形、建筑与光照',[
  ['ao','共享体素 AO',v=>v.worldMesh?.bake],['smooth','软坡几何',v=>v.worldMesh?.smooth],['stairs','楼梯显示',v=>v.navLayer?.stairs.visible],['woodladders','跨层木梯',v=>v.navLayer?.woodLadders],
  ['strata','沉积岩层',v=>v.strataMode?.value>0],['fields','田地色块',v=>v.fieldOn?.value>0],['blotch','地表笔触',v=>v.blotchOn?.value>0],['gi','彩色反弹光',v=>v.giOn?.value>0],['pointlight','点光反弹（先开彩色反弹）',v=>v.giPoint, v=>!!v.giOn?.value],['voxshadow','体素太阳遮挡',v=>v.voxOn?.value>0]
 ]],
 ['描线与镜头',[
  ['outline','几何外壳墨线',v=>v.outline?.ink.visible],['backlit','逆光亮边',v=>v.outline?.rim.visible],['thickoutline','加粗几何描线',v=>v.outline?.thickness>1],['normalcontrast','解析法线反差线',v=>v.normalContrast?.value.x>0],['hardnormal','硬边法线混合',v=>v.normMix?.value<1],['motionblur','历史画面拖影',v=>v.motionBlur]
 ]],
 ['空间、导航与战斗诊断',[
  ['grid','网格线与顶点',v=>v.gridLines?.visible],['gridregular','等距四边格网',v=>v.gridStats?.regular],['wire','主体三角线框',v=>v.material?.wireframe],['terraceedges','台地层界',v=>v.terraceEdges?.mode!=='off'&&!!v.terraceEdges?.mode],['contours','等高轮廓',v=>v.contourOverlay?.mesh.visible],['rayvis','三维空间射线',v=>v.spaceVisibility?.group.visible],['visibility','分层导航可见域',v=>v.visibilityOverlay?.group.visible],['nav','导航最短路树',v=>!!v.navLayer?.lines.visible&&!v.navLayer?.walkGraph],['navwalk','可走图',v=>v.navLayer?.walkGraph],
  ['smokecheck','烟雾棋盘诊断',v=>v.smoke?.debugChecker],['doodlewall','走廊涂鸦',v=>v.doodleOverlay?.mesh.visible],['doodlegray','涂鸦灰模',v=>v.doodleOverlay?.gray],
  ['flow','战斗流场',v=>v.flowDebug,v=>!!v.battle],['flowunit','流场按兵种着色',v=>v.flowColorBy==='type',v=>!!v.battle],['unitsprites','战斗精灵单位',v=>v.battle?.spriteBatch.enabled,v=>!!v.battle],['passages','战斗通口带',v=>v.battle?.showPassages,v=>!!v.battle],['gore','战斗血迹与尸体',v=>!v.goreOff,v=>!!v.battle]
 ]]
];
export const POST_CONTROLS=[['outline','屏幕空间描边'],['outlinepaint','笔触法线描边'],['smear','旋转速度拖影'],['clouddeck','高耸积云与云影'],['penumbra3d','体素半影接收'],['softnormals','体素软法线写回'],['windflag','旗帜读取局部风场'],['wallcards','墙根灌木折卡'],['levelflora','分层台地物种'],['dualflora','对偶区域植被'],['impostorpitch','多俯仰树冠图集']];
export const BATTLE_CONTROL_GROUPS=[
 ['c01','北境·战斗反馈与环境',[
 ['squadHud','旗顶小队状态'],['plank','小屋木跳板'],['nodeNet','战斗节点网络'],['orderPillar','命令目标柱'],['skyBeam','天光命中柱'],['bloodAge','血迹随时间变暗'],['bloodStack','重叠血迹加深'],['fireGlow','火源辉光'],['column','行军纵队'],['routePreview','命令路线预览'],['shoreFoam','岸边泡沫'],['waterBlood','水中血色'],['smokeShape','烟团形状'],['windTraces','风向轨迹'],['raidBoxes','来袭提示框'],['portraits','小队头像'],['groundTint','地面渐进染色'],['houseChar','房屋焦黑']]],
 ['c02','北境·特效与导航',[
 ['bloodShape','不规则血斑'],['scorch','焦痕与余烬'],['dmgKick','受击飘字抖动'],['flowGrid','流场背景格网'],['flowFaces','流场区域配色'],['tumble','落崖翻滚'],['wakes','长船泡沫尾迹'],['navmesh','共享导航面'],['rain','雨丝与溅点'],['swingArc','挥砍弧形拖影'],['footprint','小队地面轮廓'],['passageScreen','窄道点线（旧·固定 7px 对照）']]],
 ['c03','北境·玩法与演示',[
 ['kpow','周期爆炸演示'],['houseFx','小屋燃烧与爆炸'],['torches','向小屋投火团'],['plunge','指挥官跃击'],['confirm','命令二次确认'],['distIso','距离等值线'],['tierUp','兵种升级外观'],['flair','UI依次出现']]],
 ['g3','北境·精细导航与战斗',[
 ['finePortals','精细通口'],['continuousFlow','连续流场（本仓扩展）'],['standards','小队旗盾纹饰'],['meleeFx','近战扫掠与格挡'],['ladders','攀梯动作'],['shadowFit','影子贴合地形'],['commands','移动坚守撤退命令']]]
];
export function mountSceneCapabilityPanel(view,host,{getScene=()=>null}={}){
 const el=(t,text)=>{const n=document.createElement(t);if(text!==undefined)n.textContent=text;return n;},footer=host.querySelector('.environment-footer'),bindings=[];
 let trajectory=null,diagnostics=null,diagnosticLoad=null;const pending=new Set();
 const notice=el('p');notice.className='environment-note';notice.setAttribute('role','status');host.insertBefore(notice,footer);
 function group(title){const d=el('details'),summary=el('summary',title),grid=el('div');d.className='scene-capability-group';grid.className='environment-toggles';d.append(summary,grid);host.insertBefore(d,notice);return grid;}
 function checkbox(grid,key,label,read,write,available=()=>true,domain='view'){
  const wrap=el('label'),box=el('input');box.type='checkbox';box.dataset.sceneControl=key;box.dataset.controlDomain=domain;wrap.append(box,document.createTextNode(label));grid.append(wrap);bindings.push({box,read,available});
  box.onchange=async()=>{const previous=!!read(),wanted=box.checked;pending.add(box);try{await write(wanted);notice.textContent='已更新：'+label;window.dispatchEvent(new Event('debugsync'));}catch(error){try{await write(previous);}catch{}notice.textContent='未能应用「'+label+'」：'+error.message;}finally{pending.delete(box);sync();}};
 }
 for(const [name,rows]of SCENE_CONTROL_GROUPS){const grid=group(name+' · 当前场景');for(const [key,label,get,available]of rows)checkbox(grid,key,label,()=>get(view),on=>view.setDebug(key,on),()=> (!['flow','flowunit','unitsprites','passages','gore'].includes(key)||getScene()==='badnorth') && (available?available(view):true));}
 const post=group('已接入渲染与植被能力 · 默认关闭');
 for(const [key,label]of POST_CONTROLS)checkbox(post,key,label,()=>view.postExtras?.state[key],on=>view.postExtras.set(key,on),()=>!!view.postExtras,'post');
 for(const [key,name,rows]of BATTLE_CONTROL_GROUPS){const grid=group(name+' · 手动启用');for(const [flag,label]of rows)checkbox(grid,flag,label,()=>view.battle?.[key]?.on[flag],on=>view.battle[key].set(flag,on),()=>getScene()==='badnorth'&&!!view.battle?.[key],'battle-'+key);}
 const navGrid=group('共享 World 导航与格型诊断');
 for(const [key,label]of [['walkcorners','可走格角红点'],['navbackground','背景真实网格'],['gridtyped3d','三维格型与过渡带']])checkbox(navGrid,key,label,()=>diagnostics?.get(key),async on=>{if(!diagnostics){diagnosticLoad??=import('../world/nav-diagnostic-overlay.js').then(({mountNavDiagnosticOverlay})=>diagnostics=mountNavDiagnosticOverlay(view));await diagnosticLoad;}diagnostics.set(key,on);});
 const navInfo=el('p','背景使用当前实际网格；三维边线贴各侧高度，橙色四边格、青色三角格、绿色过渡边。格心彩块的原作语义尚无可证资料，未用颜色猜测。');navInfo.className='environment-note';navGrid.parentElement.append(navInfo);
 const trajectoryGrid=group('弹道与实际场景碰撞');let traceOptions={speed:7.61,drag:.2,dragModel:'linear'};
 checkbox(trajectoryGrid,'trajectorypreview','碰撞截断弹道预览',()=>trajectory?.visible,async on=>{if(on&&!trajectory){const {mountTrajectoryPreview}=await import('../world/trajectory-preview.js');trajectory=mountTrajectoryPreview(view);trajectory.setOptions(traceOptions);}trajectory?.setVisible(on);});
 for(const [key,label,min,max,step]of [['speed','初速度',3,14,.1],['drag','阻力',0,2,.05]]){const wrap=el('label',label),input=el('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=traceOptions[key];input.setAttribute('aria-label','弹道'+label);input.onchange=()=>{traceOptions={...traceOptions,[key]:+input.value};trajectory?.setOptions(traceOptions);};wrap.append(input);trajectoryGrid.append(wrap);}
 const modelLabel=el('label','阻力模型'),model=el('select');model.setAttribute('aria-label','弹道阻力模型');for(const [value,text]of [['linear','线性'],['quadratic','二次（可选模拟）']]){const o=el('option',text);o.value=value;model.append(o);}model.onchange=()=>{traceOptions={...traceOptions,dragModel:model.value};trajectory?.setOptions(traceOptions);};modelLabel.append(model);trajectoryGrid.append(modelLabel);
 const traceNote=el('p','青线是预览，橙点为碰撞终点；按当前主体网格截断，不产生伤害或改动地形。二次阻力是可选模型，原片未确定其采用哪一种。');traceNote.className='environment-note';trajectoryGrid.parentElement.append(traceNote);
 const info=el('p','这些开关直接作用于当前岛屿。火、灯室和船迹控制已有对象，不凭开关生成对象。战斗项只在北境场景可用；重算 AO、软坡和图集会按需重建。');info.className='environment-note';host.insertBefore(info,notice);
 function sync(){try{trajectory?.refresh();diagnostics?.refresh();}catch(error){notice.textContent='弹道预览失败：'+error.message;}for(const {box,read,available}of bindings){if(pending.has(box))continue;box.checked=!!read();box.disabled=!available();box.title=box.disabled?'当前场景或依赖未就绪':'';}}
 window.addEventListener('debugsync',sync);window.addEventListener('scenechange',sync);const timer=setInterval(sync,500);sync();
 return{sync,dispose(){trajectory?.dispose();diagnostics?.dispose();clearInterval(timer);window.removeEventListener('debugsync',sync);window.removeEventListener('scenechange',sync);}};
}
