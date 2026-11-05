import { MAX_LEVEL } from './world.js';

/** Local deterministic stress sequence inspired by 1344290848180203523's edits.
 * Not a recovered original test runner or a claim that vivid colors prove QA. */
export function makeQASequence(world) {
  const cells = [...world.cells].sort((a,b) => Math.hypot(a.cx,a.cz)-Math.hypot(b.cx,b.cz) || a.id-b.id).slice(0,4);
  return cells.flatMap((cell,i) => [
    {cell:cell.id,level:MAX_LEVEL,on:true,color:i % world.palette.colors.length},
    {cell:cell.id,level:MAX_LEVEL-1,on:true,color:i % world.palette.colors.length},
    {cell:cell.id,level:MAX_LEVEL-1,on:false},
    {cell:cell.id,level:1,on:false},
  ]);
}
export function applyQAStep(world, step) {
  const {cell,level,on,color}=step;
  if(!Number.isInteger(cell)||!world.cells[cell]||!Number.isInteger(level)||level<1||level>MAX_LEVEL||typeof on!=='boolean'||(color!==undefined&&(!Number.isInteger(color)||color<0||color>=world.palette.colors.length)))throw new RangeError('Invalid QA edit');
  world.setSolid(world.cells[cell],level,on);
  if(color!==undefined&&world.color[cell]!==color){world.color[cell]=color;world.touch();}
}
export function auditQAGeometry(geometry) {
  const position=geometry.getAttribute('position'), color=geometry.getAttribute('color'), normal=geometry.getAttribute('normal');
  const errors=[];
  for(const [name,a] of [['position',position],['color',color],['normal',normal]]) {
    if(!a||a.itemSize!==3||a.count!==position?.count)errors.push(`${name}: missing/mismatched attribute`);
    else if(!a.array.every(Number.isFinite))errors.push(`${name}: nonfinite values`);
  }
  const index=geometry.index, count=index?.count??position?.count??0;
  if(count%3)errors.push('Incomplete triangle');
  if(index&&(!index.array.every(i=>i>=0&&i<position.count)))errors.push('Index outside vertex range');
  let degenerateTriangles=0;
  if(!errors.length)for(let j=0;j<count;j+=3){
    const ids=[0,1,2].map(k=>index?index.array[j+k]:j+k),p=position.array;
    const u=[0,1,2].map(k=>p[ids[1]*3+k]-p[ids[0]*3+k]),v=[0,1,2].map(k=>p[ids[2]*3+k]-p[ids[0]*3+k]);
    if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-10)degenerateTriangles++;
  }
  return {valid:errors.length===0,errors,vertices:position?.count??0,triangles:count/3,degenerateTriangles};
}

/** Always restores shared occupancy, wall colors, rivers and palette, including on failure. */
export async function runWorldQA(api, { afterStep=async()=>{} }={}) {
  const {world,view}=api,saved=world.snapshot(),palette=world.palette,steps=makeQASequence(world),reports=[];
  try {
    for(const step of steps){applyQAStep(world,step);view.changed();view.render(0);const report=auditQAGeometry(view.worldMesh.geometry);reports.push({step,...report});if(!report.valid)throw Error(report.errors.join('; '));await afterStep(reports.at(-1));}
    return {steps:reports,valid:true,scope:'Finite attributes and valid triangle indices; degeneracy reported separately, no manifold/visual proof'};
  } finally {
    world.restore(saved);world.palette=palette;view.changed();view.render(0);
  }
}
