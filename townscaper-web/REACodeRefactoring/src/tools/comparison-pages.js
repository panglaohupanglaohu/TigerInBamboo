/** REACode/compare.html consumer catalog, separated from DOM and with current library destinations. */
export const COMPARISON_PAGES=Object.freeze([
 Object.freeze({id:'original',name:'原版 Townscaper（只读参照）',path:'../REACode/Townscaper.html'}),
 Object.freeze({id:'fusion',name:'重构版 · 融合',path:'index.html?scene=fusion'}),
 Object.freeze({id:'terrain',name:'重构版 · 地形',path:'index.html?scene=terrain'}),
 Object.freeze({id:'perspective',name:'重构版 · 混合透视',path:'mixed-perspective.html'}),
 Object.freeze({id:'fire',name:'重构版 · 火焰',path:'fire.html'}),
]);
export function comparisonSelection(query){const q=new URLSearchParams(query),allowed=new Set(COMPARISON_PAGES.map(p=>p.id));return{left:allowed.has(q.get('left'))?q.get('left'):'original',right:allowed.has(q.get('right'))?q.get('right'):'fusion'};}
export function comparisonPage(id){const row=COMPARISON_PAGES.find(p=>p.id===id);if(!row)throw new RangeError('unknown comparison page');return row;}
