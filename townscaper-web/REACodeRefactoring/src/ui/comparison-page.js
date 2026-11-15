import {COMPARISON_PAGES,comparisonSelection,comparisonPage} from '../tools/comparison-pages.js';
const selected=comparisonSelection(location.search),query=new URLSearchParams(location.search);
for(const side of ['left','right']){
 const selector=document.getElementById(side),frame=document.getElementById(side+'-frame'),label=document.getElementById(side+'-label');
 for(const p of COMPARISON_PAGES)selector.add(new Option(p.name,p.id));selector.value=selected[side];
 function load(){const p=comparisonPage(selector.value);frame.src=new URL('../../'+p.path,import.meta.url);label.textContent=p.name;query.set(side,p.id);history.replaceState(null,'','?'+query);}
 selector.onchange=load;load();
}
