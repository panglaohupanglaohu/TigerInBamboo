import assert from 'node:assert/strict';import {NodeGraphEditor} from '../src/core/node-graph-editor.js';
const m=new NodeGraphEditor(),before=m.snapshot();m.move('button',100,150);assert.equal(m.layout.button.x,100);m.undo();assert.deepEqual(m.snapshot(),before);m.redo();assert.equal(m.layout.button.y,150);
const id=m.add('constant');m.parameter(id,'value',42);m.graph.tick(0);assert.equal(m.graph.get(id),42);m.remove(id);assert.ok(!m.graph.nodes.has(id));m.undo();assert.ok(m.graph.nodes.has(id));m.redo();assert.ok(!m.graph.nodes.has(id));
function unchanged(fn){const before=JSON.stringify(m.snapshot());assert.throws(fn);assert.equal(JSON.stringify(m.snapshot()),before);}
unchanged(()=>m.connect('button','out','lerp','target'));unchanged(()=>m.connect('falseValue','out','select','onTrue'));unchanged(()=>m.parameter('lerp','speed',-1));unchanged(()=>m.parameter('button','initial',1));unchanged(()=>m.move('button',Infinity,1));unchanged(()=>m.add('__proto__'));
const edge=m.graph.edges.findIndex(e=>e.toId==='lerp');m.disconnect(edge);unchanged(()=>m.connect('lerp','out','lerp','target'));
m.connect('trueValue','out','lerp','target');m.graph.state('button').value=true;m.graph.tick(.1);const json=m.snapshot(),copy=new NodeGraphEditor({document:json});for(let i=0;i<90;i++){m.graph.tick(1/60);copy.graph.tick(1/60);assert.deepEqual(m.graph.snapshot(),copy.graph.snapshot());}assert.deepEqual(m.layout,copy.layout);
const bad=structuredClone(json);bad.graph.nodes.find(n=>n.id==='lerp').state.value='bad';unchanged(()=>m.load(bad));
console.log('PASS real graph edits, type/single-input/cycle/budget rejection atomicity, undo/redo, state/layout roundtrip,90-frame parity');
