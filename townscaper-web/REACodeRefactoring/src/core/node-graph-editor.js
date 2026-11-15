import {NodeGraph,NODE_REGISTRY,buildToggleChain} from './node-graph-runtime.js';
export const EDITOR_TYPES={boolSource:{initial:false},constant:{value:0},variable:{value:0},select:{onTrue:1,onFalse:0},lerpTowards:{speed:20,initial:0},compose2:{x:0,y:0},sink:{epsilon:0},multiply:{k:1},addConstant:{k:0}};
const clone=x=>JSON.parse(JSON.stringify(x));
const portType=(n,port,out=false)=>out?(n.type==='boolSource'?'bool':n.type==='compose2'?'vector':'number'):(n.type==='select'&&port==='condition'?'bool':n.type==='sink'?'any':'number');
function finiteTree(x,depth=0){if(depth>8)throw Error('数据层级过深');if(x===null||typeof x==='boolean'||typeof x==='string')return;if(typeof x==='number'&&Number.isFinite(x))return;if(x&&typeof x==='object'){for(const [k,v]of Object.entries(x)){if(['__proto__','constructor','prototype'].includes(k))throw Error('无效字段');finiteTree(v,depth+1);}return;}throw Error('数值必须有限');}
/** Transactions preserve the old graph on every rejected edit; no eval of imported code. */
export class NodeGraphEditor{
 constructor({sinkFn=()=>{},document=null}={}){this.sinkFn=sinkFn;this.past=[];this.future=[];this.load(document||{version:1,graph:buildToggleChain().graph.serialize(),layout:{}},false);}
 snapshot(){return{version:1,graph:this.graph.serialize(),layout:clone(this.layout)};}
 load(doc,remember=true){if(JSON.stringify(doc).length>250000||doc?.version!==1||!doc.graph||!Array.isArray(doc.graph.nodes)||!Array.isArray(doc.graph.edges)||doc.graph.nodes.length>128||doc.graph.edges.length>512)throw Error('图超出预算或格式无效');finiteTree(doc);
  const next=clone(doc),types=new Map();for(const n of next.graph.nodes){if(!/^[A-Za-z][\w-]{0,47}$/.test(n.id)||!Object.hasOwn(EDITOR_TYPES,n.type)||types.has(n.id))throw Error('节点ID或类型无效');types.set(n.id,n);for(const [k,v]of Object.entries(n.params||{})){const def=EDITOR_TYPES[n.type];if(!Object.hasOwn(def,k)||typeof v!==typeof def[k]||typeof v==='number'&&Math.abs(v)>1e6)throw Error('参数类型或范围无效');}if(n.state?.value!==undefined&&typeof n.state.value!==(n.type==='boolSource'?'boolean':'number'))throw Error('节点状态类型无效');}
  const incoming=new Set();for(const e of next.graph.edges){const a=types.get(e.fromId),b=types.get(e.toId),key=e.toId+':'+e.toPort;if(!a||!b||incoming.has(key))throw Error('每个输入只能接一条线');incoming.add(key);const A=portType(a,e.fromPort,true),B=portType(b,e.toPort);if(B!=='any'&&A!==B)throw Error('端口类型不匹配');}
  const candidate=NodeGraph.fromJSON(next.graph);candidate.order();candidate.evaluate(0);for(const n of next.graph.nodes)if(n.type==='sink'&&n.state?.last!==undefined){const input=candidate.nodes.get(n.id).in.in,prev=n.state.last;if(typeof input!==typeof prev||input&&typeof input==='object'&&(!prev||!Number.isFinite(prev.x)||!Number.isFinite(prev.y)))delete n.state.last;}for(const n of candidate.nodes.values())finiteTree(n.out);
  const layout={};let i=0;for(const n of next.graph.nodes){const p=next.layout?.[n.id]||{x:20+(i%4)*250,y:20+Math.floor(i/4)*240};if(![p.x,p.y].every(Number.isFinite)||p.x<0||p.y<0||p.x>1800||p.y>1200)throw Error('节点位置超出画布');layout[n.id]={x:p.x,y:p.y};i++;}
  if(remember&&this.graph){this.past.push(this.snapshot());if(this.past.length>50)this.past.shift();this.future=[];}this.graph=NodeGraph.fromJSON(next.graph,{sinkFn:this.sinkFn});this.layout=layout;this.graph.evaluate(0);
 }
 edit(fn){const doc=this.snapshot();fn(doc);this.load(doc);}
 add(type){if(!Object.hasOwn(EDITOR_TYPES,type))throw Error('未知节点');let id=type,seq=1;while(this.graph.nodes.has(id))id=type+seq++;this.edit(d=>d.graph.nodes.push({id,type,params:clone(EDITOR_TYPES[type]),state:null}));return id;}
 remove(id){if(!this.graph.nodes.has(id))throw Error('未知节点');this.edit(d=>{d.graph.nodes=d.graph.nodes.filter(n=>n.id!==id);d.graph.edges=d.graph.edges.filter(e=>e.fromId!==id&&e.toId!==id);delete d.layout[id];});}
 connect(fromId,fromPort,toId,toPort){this.edit(d=>d.graph.edges.push({fromId,fromPort,toId,toPort}));}
 disconnect(index){if(!Number.isInteger(index)||index<0||index>=this.graph.edges.length)throw Error('未知连线');this.edit(d=>d.graph.edges.splice(index,1));}
 move(id,x,y){if(!this.graph.nodes.has(id))throw Error('未知节点');this.edit(d=>d.layout[id]={x,y});}
 parameter(id,key,value){if(!this.graph.nodes.has(id))throw Error('未知节点');this.edit(d=>{const n=d.graph.nodes.find(n=>n.id===id);n.params[key]=value;if(key==='value'||key==='initial'){if(n.state&&Object.hasOwn(n.state,'value'))n.state.value=value;}});}
 undo(){if(!this.past.length)return false;const previous=this.past.pop(),current=this.snapshot();this.load(previous,false);this.future.push(current);return true;}
 redo(){if(!this.future.length)return false;const next=this.future.pop(),current=this.snapshot();this.load(next,false);this.past.push(current);return true;}
}
