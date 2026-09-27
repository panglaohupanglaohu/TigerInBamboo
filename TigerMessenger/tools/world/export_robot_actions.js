// Add baked rigid-joint animation to an original geometry capture. No skin or
// generated replacement geometry: each moving armor group keeps its own node.
import {exportWorldGLB} from './export_world_glb.js';
export function exportRobotActions(model,THREE,animate){
 const scene=new THREE.Scene();scene.add(model);const kind=model.userData.robotType;
 const objects=[];model.traverse(o=>{if(o.name.startsWith('joint-')||['robot-rifle','robot-pressure-cannon','robot-cup'].includes(o.name))objects.push(o);});
 const clips=[];
 for(const state of ['idle','move','attack','transport','disabled']){
  const duration=state==='move'?(kind==='ant'?2*Math.PI/3.8:2*Math.PI/5):state==='attack'?2.4:1;
  const frames=Math.ceil(duration*30),times=Array.from({length:frames+1},(_,i)=>i/frames*duration),tracks=objects.map(o=>({name:o.name,position:[],rotation:[]}));
  for(const t of times){animate(model,{state,time:t,speed:state==='move'?({locust:2.2,ant:1.5,beetle:3.8}[kind]):0,recoil:state==='attack'?Math.max(0,1-(t%.6)*7):0});
   objects.forEach((o,i)=>{const track=tracks[i],q=o.quaternion.toArray(),last=track.rotation.slice(-4);if(last.length&&last.reduce((s,v,k)=>s+v*q[k],0)<0)for(let j=0;j<4;j++)q[j]*=-1;track.position.push(...o.position.toArray());track.rotation.push(...q);});
  }
  clips.push({name:state,duration,times,tracks});
 }
 animate(model,{state:'idle'});model.updateMatrixWorld(true);
 const original=exportWorldGLB(scene,THREE,{robot:model}),view=new DataView(original.bytes.buffer,original.bytes.byteOffset,original.bytes.byteLength),jsonLength=view.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(original.bytes.subarray(20,20+jsonLength))),binStart=28+jsonLength,oldBin=original.bytes.subarray(binStart);let offset=oldBin.length;const chunks=[oldBin];
 function accessor(values,type){const data=new Float32Array(values),components=type==='SCALAR'?1:type==='VEC3'?3:4,index=doc.accessors.length,bufferView=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.byteLength});chunks.push(new Uint8Array(data.buffer));offset+=data.byteLength;doc.accessors.push({bufferView,componentType:5126,count:values.length/components,type,...(type==='SCALAR'?{min:[values[0]],max:[values[values.length-1]]}:{})});return index;}
 const nodeIds=new Map();for(const object of objects){const id=doc.nodes.findIndex(n=>n.name===object.name);if(id<0)throw Error('Missing articulated node '+object.name);nodeIds.set(object.name,id);const n=doc.nodes[id],p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();new THREE.Matrix4().fromArray(n.matrix).decompose(p,q,s);delete n.matrix;n.translation=p.toArray();n.rotation=q.toArray();n.scale=s.toArray();}
 doc.animations=clips.map(clip=>{const input=accessor(clip.times,'SCALAR'),samplers=[],channels=[];for(const track of clip.tracks){for(const [path,type,values]of [['translation','VEC3',track.position],['rotation','VEC4',track.rotation]]){const sampler=samplers.length;samplers.push({input,output:accessor(values,type),interpolation:'LINEAR'});channels.push({sampler,target:{node:nodeIds.get(track.name),path}});}}return{name:clip.name,samplers,channels,extras:{source:'Baked from the same procedural joints used in the live game',duration:clip.duration}};});
 doc.asset.generator='TigerMessenger articulated robot action capture';doc.buffers[0].byteLength=offset;
 const encoded=new TextEncoder().encode(JSON.stringify(doc)),padded=new Uint8Array((encoded.length+3)&~3);padded.fill(32);padded.set(encoded);const bytes=new Uint8Array(28+padded.length+offset),out=new DataView(bytes.buffer);out.setUint32(0,0x46546c67,true);out.setUint32(4,2,true);out.setUint32(8,bytes.length,true);out.setUint32(12,padded.length,true);out.setUint32(16,0x4e4f534a,true);bytes.set(padded,20);let at=20+padded.length;out.setUint32(at,offset,true);out.setUint32(at+4,0x004e4942,true);at+=8;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 return{bytes,manifest:{kind,rigVersion:model.userData.rigVersion,sourceModelVersion:model.userData.modelVersion,bytes:bytes.length,nodes:doc.nodes.length,joints:objects.length,clips:clips.map(c=>({name:c.name,duration:c.duration,frames:c.times.length})),limitations:['Rigid articulated nodes, not a skinned humanoid skeleton.','Procedural patina, outline effects and gameplay logic remain authoritative in the native Three.js model.','Movement clips are in place; navigation and projectile effects are not baked into the mesh.','Beetle rolling wheel phase is continuous within the move clip; continuous looping requires an engine animation controller.']}};
}
