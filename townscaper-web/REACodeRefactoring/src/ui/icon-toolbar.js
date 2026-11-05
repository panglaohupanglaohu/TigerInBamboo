/** 1201179450668441600 "Icons!": local single-selection toolbar behaviour.
 * Artwork and gameplay actions remain supplied by the consumer.
 */
export function mountIconToolbar(host,items,{value,onChange=()=>{}}={}){
 if(!host||!Array.isArray(items)||!items.length||typeof onChange!=='function')throw new TypeError('Invalid toolbar');
 const keys=items.map(x=>x.key);if(keys.some(k=>typeof k!=='string'||!k)||new Set(keys).size!==keys.length||items.some(x=>typeof x.label!=='string'||!x.label))throw new TypeError('Invalid toolbar items');
 const enabled=items.filter(x=>!x.disabled);if(!enabled.length)throw new RangeError('No enabled toolbar items');
 let selected=value??enabled[0].key;if(!enabled.some(x=>x.key===selected))throw new RangeError('Disabled or unknown selection');
 const abort=new AbortController(),animations=new Set(),buttons=[];let disposed=false;
 host.setAttribute('role','toolbar');host.setAttribute('aria-orientation','vertical');
 function paint(){for(const b of buttons){const on=b.dataset.key===selected;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));b.tabIndex=on?0:-1;}}
 function select(key,{focus=false,notify=false}={}){if(disposed)throw new Error('Toolbar disposed');if(!enabled.some(x=>x.key===key))throw new RangeError('Disabled or unknown selection');const changed=selected!==key;selected=key;paint();const b=buttons.find(x=>x.dataset.key===key);if(focus)b.focus();if(notify&&changed)onChange(key);return b;}
 for(const item of items){const b=document.createElement('button');b.type='button';b.className='ic';b.dataset.key=item.key;b.setAttribute('aria-label',item.label);b.disabled=!!item.disabled;b.style.background=item.color??'';item.render?.(b);buttons.push(b);host.append(b);
  b.addEventListener('click',()=>{select(item.key,{notify:true});if(!matchMedia('(prefers-reduced-motion: reduce)').matches){for(const a of animations)a.cancel();animations.clear();const a=b.animate([{transform:'rotate(-4deg) scale(1.2)'},{transform:'rotate(-4deg) scale(1.08)'}],180);animations.add(a);a.finished.then(()=>animations.delete(a),()=>animations.delete(a));}},{signal:abort.signal});
  b.addEventListener('keydown',e=>{const i=enabled.findIndex(x=>x.key===selected);let next;if(e.key==='ArrowDown'||e.key==='ArrowRight')next=(i+1)%enabled.length;else if(e.key==='ArrowUp'||e.key==='ArrowLeft')next=(i-1+enabled.length)%enabled.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=enabled.length-1;else return;e.preventDefault();select(enabled[next].key,{focus:true,notify:true});},{signal:abort.signal});
 }
 paint();return{get value(){return selected},setValue:key=>select(key),dispose(){if(disposed)return;disposed=true;abort.abort();for(const a of animations)a.cancel();animations.clear();for(const b of buttons)b.remove();}};
}
