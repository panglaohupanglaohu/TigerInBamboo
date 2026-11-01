import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const v=(...a)=>new T.Vector3(...a),mat=c=>new T.MeshStandardMaterial({color:c,roughness:.94,side:T.DoubleSide});
const transform=(g,p,s=[1,1,1],q=new T.Quaternion())=>g.applyMatrix4(new T.Matrix4().compose(v(...p),q,v(...s)));
function leafGeometry(){const shape=new T.Shape();for(let i=0;i<40;i++){const a=i/40*Math.PI*2,r=.65*(.66+.34*Math.cos(a*5));const x=Math.cos(a)*r,y=Math.sin(a)*r;i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();const g=new T.ShapeGeometry(shape);g.rotateX(-Math.PI/2);return g;}
function addMerged(root,geos,material,name){if(!geos.length)return;const g=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());const m=new T.Mesh(g,material);m.name=name;m.castShadow=true;m.receiveShadow=true;root.add(m);return m;}
export function createMorrisPlaneTree({scale=1}={}){
 scale*=.85;const root=new T.Group();root.name='morris-palmate-plane-tree';const wood=mat(0x8c7954),leaves=[mat(0x58704e),mat(0x879061)],fruit=mat(0xa75e3f),branches=[],crown=[[],[]],seeds=[],perches=[];
 for(const side of [-1,0,1]){const pts=[v(0,0,0),v(side*.4,2.5,.1),v(side*1.6,4.7,.2),v(side*3.2,6.1,-.3),v(side*4.5,6.8,.3)];const curve=new T.CatmullRomCurve3(pts);branches.push(new T.TubeGeometry(curve,22,side===0?.29:.18,7,false));for(let i=0;i<28;i++){const t=.47+i/55,p=curve.getPoint(t),angle=i*2.4;const q=new T.Quaternion().setFromEuler(new T.Euler(Math.sin(i)*.45,i*1.3,Math.cos(i)*.35));p.x+=Math.cos(angle)*.85;p.z+=Math.sin(angle)*1.15;crown[i%2].push(transform(leafGeometry(),p.toArray(),[.9+i%3*.14,1,.9+i%3*.14],q));if(i%6===0){seeds.push(transform(new T.SphereGeometry(.13,7,5),[p.x,p.y-.32,p.z]));seeds.push(transform(new T.SphereGeometry(.12,7,5),[p.x+.12,p.y-.6,p.z]));}}perches.push(curve.getPoint(.98).add(v(.1,.28,.05)));}
 addMerged(root,branches,wood,'plane-visible-branch-silhouette');crown.forEach((g,i)=>addMerged(root,g,leaves[i],'plane-five-lobed-palmate-leaves'));addMerged(root,seeds,fruit,'plane-paired-pendant-seedballs');root.scale.setScalar(scale);root.userData.perches=perches.map(p=>p.multiplyScalar(scale));return root;
}
export function createMorrisCypress({height=9,fork=false}={}){
 const root=new T.Group();root.name='morris-tapered-scale-leaf-cypress';root.scale.setScalar(.85);const wood=mat(0x665c3e),green=[mat(0x344e3b),mat(0x60724a)],tufts=[[],[]];
 const trunk=new T.Mesh(new T.CylinderGeometry(.09,.25,height*.86,7),wood);trunk.position.y=height*.43;root.add(trunk);
 for(let i=0;i<170;i++){const t=i/170,y=height*(.16+.82*t),a=i*2.399,w=(.7+.3*Math.sin(t*Math.PI))*Math.pow(1-t,.68)*height*.13,x=Math.cos(a)*w,z=Math.sin(a)*w;const q=new T.Quaternion().setFromEuler(new T.Euler(Math.sin(a)*.3,a,Math.cos(a)*.3));tufts[i%2].push(transform(new T.SphereGeometry(1,6,5),[x+(fork&&t>.6?.55*(t-.6):0),y,z],[.22,.42*(1-t)+.18,.18],q));}
 tufts.forEach((g,i)=>addMerged(root,g,green[i],'cypress-upright-layered-scale-sprays'));return root;
}
export function createMorrisHollyhock({height=3.8,color=0xb8463b}={}){
 const root=new T.Group();root.name='morris-hollyhock-tall-red-flower-spire';root.scale.setScalar(.85);const stem=mat(0x536a43),red=mat(color),gold=mat(0xc6a45e),stems=[],leaves=[],flowers=[],hearts=[];
 for(let k=0;k<3;k++){const x=(k-1)*.38,z=Math.sin(k)*.35,h=height*(1-k*.13);stems.push(transform(new T.CylinderGeometry(.028,.05,h,5),[x,h/2,z]));for(let j=0;j<6;j++){const y=.3+j*h*.105,q=new T.Quaternion().setFromEuler(new T.Euler(.2,j*2.4,.3));leaves.push(transform(leafGeometry(),[x+Math.sin(j)*.28,y,z+Math.cos(j)*.25],[.58,.58,.58],q));}
 for(let j=0;j<8;j++){const y=h*(.32+j*.083),a=j*2.4,r=.18,q=new T.Quaternion().setFromEuler(new T.Euler(Math.PI*.4,a,0));for(let petal=0;petal<5;petal++){const angle=petal*Math.PI*.4;flowers.push(transform(new T.SphereGeometry(1,8,5),[x+Math.cos(a)*r+Math.cos(angle)*.17,y+Math.sin(angle)*.17,z+Math.sin(a)*r],[.18,.17,.065],q));}hearts.push(transform(new T.SphereGeometry(.065,6,4),[x+Math.cos(a)*r,y,z+Math.sin(a)*r+.065]));}}
 addMerged(root,stems,stem,'hollyhock-three-upright-stalks');addMerged(root,leaves,stem,'hollyhock-broad-basal-leaves');addMerged(root,flowers,red,'hollyhock-five-petalled-red-cups');addMerged(root,hearts,gold,'hollyhock-gold-throats');return root;
}
export function installMorrisBotany({root,heightAt,pathDistance,canPlant=()=>true}){
 const trees=[],cypresses=[],hollyhocks=[];
 for(const[x,z,scale]of[[-32,18,1.25],[29,20,1.4],[-26,-24,1.1],[30,-23,1.15],[2,37,1.3],[-40,-2,1]]){const t=createMorrisPlaneTree({scale});t.position.set(x,heightAt(x,z),z);root.add(t);trees.push(t);}
 for(let i=0;i<14;i++){const a=i/14*Math.PI*2,r=36+(i%3)*3,x=Math.cos(a)*r,z=Math.sin(a)*r;if(pathDistance(x,z)<3||!canPlant(x,z))continue;const t=createMorrisCypress({height:8+(i%4)*1.3,fork:i%3===0});t.position.set(x,heightAt(x,z),z);root.add(t);cypresses.push(t);}
 for(let i=0;i<34;i++){const a=i*2.399,r=24+(i%5)*4.5,x=Math.cos(a)*r,z=Math.sin(a)*r;if(pathDistance(x,z)<2.4||!canPlant(x,z))continue;const f=createMorrisHollyhock({height:2.8+(i%4)*.4,color:[0xa83c38,0xc05245,0xa84d60][i%3]});f.position.set(x,heightAt(x,z),z);root.add(f);hollyhocks.push(f);}
 root.updateWorldMatrix(true,true);const buckets=new Map(),inverse=root.matrixWorld.clone().invert();
 for(const plant of [...trees,...cypresses,...hollyhocks])for(const mesh of [...plant.children])if(mesh.isMesh){const key=mesh.material.color.getHex();if(!buckets.has(key))buckets.set(key,{mat:mesh.material,geos:[]});buckets.get(key).geos.push(mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));plant.remove(mesh);mesh.geometry.dispose();}
 for(const {mat,geos}of buckets.values())addMerged(root,geos,mat,'morris-batched-botanical-geometry');
 return{trees,cypresses,hollyhocks,report:{planeTrees:trees.length,cypresses:cypresses.length,hollyhockClumps:hollyhocks.length}};
}
