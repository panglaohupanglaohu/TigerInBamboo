import {CAPABILITIES,validateRecipe,effectiveSettings} from './pipeline-model.js';
import {checkedSettings} from './experiment-session.js';
// Execution inventory, not a promise that every scanned source can run.
export function inspectExecution(recipe){
 validateRecipe(recipe);
 const steps=recipe.nodes.filter(n=>n.enabled).map(n=>{const cap=CAPABILITIES.find(c=>c.id===n.id);return {id:n.id,name:cap.name,mode:cap.mode,controls:cap.controls||[],state:cap.mode==='live'?'executable':cap.mode==='editor'?'manual':'adapter-missing',source:cap.source};});
 return {steps,executable:steps.every(s=>s.state==='executable'),blocked:steps.filter(s=>s.state!=='executable')};
}
export function executeSupportedPreview(snapshot){
 if(snapshot?.scene!=='morris-lake'||typeof snapshot.data!=='string'||!snapshot.data)throw Error('本地Source场景快照无效');
 const baseline=checkedSettings(snapshot.settings),plan=inspectExecution(snapshot.recipe);
 if(!plan.executable&&snapshot.execution!=='supported-preview')throw Error('管线有未适配或手工步骤，不能宣称完整执行');
 const proposed=checkedSettings(effectiveSettings(snapshot.recipe,baseline));
 for(const key of snapshot.locks?.settings||[]){if(!Object.hasOwn(baseline,key))throw Error('锁定参数无效');proposed[key]=baseline[key];}
 return {scene:snapshot.scene,data:snapshot.data,settings:proposed,recipe:structuredClone(snapshot.recipe),plan,status:plan.executable?'preview':'partial-preview',geometryChanged:false,checks:{codec:'not-run',geometry:'preserved',settings:'validated'},scope:'Deterministic existing-parameter preview only; not model execution or gameplay acceptance.'};
}
