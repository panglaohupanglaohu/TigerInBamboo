import * as THREE from 'three';
import {GREG_LAKE_PALETTE as PAL} from './swampGregVisuals.js';
import {createSwampGroundSampler} from './swampGround.js';
import {swampRimOuter} from './swampCoralRim.js';

// 湖沼步道护栏（无形）：2026-10-09 用户要求“信使能方便地走一圈，不会走着掉下去”。
// 湖沼坑位于大峡谷台阶之间、低于周围地表：坑缘内侧是坑壁和湖底，外侧在
// 一些方位是更低的峡谷台阶。本模块不改任何美术或地面采样，只在玩家物理步
// 结束后检查“这一步是否会让人从步道掉下去”：
//   * 下方实际承托比起步时低于 maxDrop，且落点不是湖沼步道网 → 撤回本步切向位移；
//   * 落点仍是步道网（例如从坑外台地跳回坑缘、从坑缘跳到下层岸台）→ 允许；
//   * 万一已经下坠（读档、剧情传送等），低于最近安全点 rescueDrop 后送回安全点。
// 步道网 = 坑缘环、三层岸台与连接坡、虎台阶、码头（均为已登记的 walkMeshes）。
// 关闭：URL 参数 swampEdgeGuard=0。
export function collectSwampWalkNetwork(inner){
  if(!inner?.userData)return [];
  const u=inner.userData;
  return [...(u.gregCoralRim?.walkMeshes||[]),...(u.gregSpatialPlan?.walkMeshes||[]),
    ...(u.tigerWalkSurfaces||[]),...(u.gregShoreDock?.walkMeshes||[]),...(u.swampHarborScene?.pier?.walkMeshes||[]),...(u.swampEntranceBridge?.walkMeshes||[])].filter((m,i,a)=>m?.isMesh&&m.geometry&&a.indexOf(m)===i);
}

// 坑缘环在虎台阶入口处留有约 9 单位缺口，原来只有顶阶外侧约 1 单位宽能横跨，
// 稍偏一点就会掉到第二级台阶下。这里沿坑缘外半圈补一块与坑缘同高的石板，
// 只覆盖顶阶以外（半径 37.7 起），不遮挡虎和信使下台阶的通道。
export function installSwampEntranceBridge(inner){
  const u=inner?.userData;if(!u)return null;
  if(u.swampEntranceBridge)return u.swampEntranceBridge;
  const rim=u.gregCoralRim;if(!rim?.ok)return null;
  const y=rim.topY,a0=rim.entranceAngle-rim.entranceHalfAngle-.035,a1=rim.entranceAngle+rim.entranceHalfAngle+.035;
  const rIn=37.7,outer=a=>swampRimOuter(a)-.05,depth=.9,n=10;
  const pos=[],col=[],top=new THREE.Color(PAL.stone).lerp(new THREE.Color(PAL.stoneShade),.2),side=new THREE.Color(PAL.wall),sideB=new THREE.Color(PAL.wallShade);
  const P=(a,r,h)=>[Math.cos(a)*r,h,Math.sin(a)*r];
  const quad=(A,B,C,D,c)=>{for(const v of [A,B,C,A,C,D]){pos.push(...v);col.push(c.r,c.g,c.b);}};
  for(let i=0;i<n;i++){
    const a=a0+(a1-a0)*i/n,b=a0+(a1-a0)*(i+1)/n;
    const A=P(a,rIn,y),B=P(b,rIn,y),C=P(b,outer(b),y),D=P(a,outer(a),y);
    const A2=P(a,rIn,y-depth),B2=P(b,rIn,y-depth),C2=P(b,outer(b),y-depth),D2=P(a,outer(a),y-depth);
    quad(A,B,C,D,top);quad(D,D2,C2,C,i%2?side:sideB);quad(B,B2,A2,A,sideB);quad(A2,B2,C2,D2,sideB);
    if(i===0)quad(A,A2,D2,D,side);if(i===n-1)quad(C,C2,B2,B,side);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.computeVertexNormals();g.computeBoundingSphere();g.computeBoundingBox();
  const mat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false,fog:false});
  const mesh=new THREE.Mesh(g,mat);mesh.name='swamp-entrance-rim-bridge';mesh.userData.gregWalkable=true;inner.add(mesh);
  const sampler=createSwampGroundSampler(inner,[mesh]);
  const report={ok:true,version:1,angles:[a0,a1],radii:[rIn,'rim outer edge'],topY:y,walkMeshes:[mesh],
    // Same contract as the other swamp supports: only near feet, never lifts someone far below.
    ground(position){const r=sampler(position);if(!Number.isFinite(r))return null;const h=position.length()-r;return h>=-.6&&h<=3.5?r:null;},
    dispose(){mesh.removeFromParent();g.dispose();mat.dispose();if(u.swampEntranceBridge===report)delete u.swampEntranceBridge;}};
  u.swampEntranceBridge=report;return report;
}

// Highest network surface along radial gravity that is not above the feet by more than `above`.
export function createSwampNetworkSampler(inner,getMeshes=()=>collectSwampWalkNetwork(inner),{topFacesOnly=true}={}){
  const inverse=new THREE.Matrix4(),ray=new THREE.Ray(),origin=new THREE.Vector3(),dir=new THREE.Vector3();
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),hit=new THREE.Vector3(),e1=new THREE.Vector3(),e2=new THREE.Vector3(),nrm=new THREE.Vector3();
  return function networkRadius(position,above=.8){
    const meshes=getMeshes();if(!meshes.length)return null;
    const limit=position.length()+above;let best=-Infinity;
    dir.copy(position).normalize().negate();origin.copy(position).normalize().multiplyScalar(limit+.01);
    for(const mesh of meshes){
      mesh.updateWorldMatrix(true,false);inverse.copy(mesh.matrixWorld).invert();
      ray.set(origin,dir).applyMatrix4(inverse);
      const g=mesh.geometry,pos=g.attributes.position,idx=g.index,count=idx?idx.count:pos.count;
      if(g.boundingSphere===null)g.computeBoundingSphere();
      if(g.boundingSphere&&!ray.intersectsSphere(g.boundingSphere))continue;
      for(let i=0;i<count;i+=3){
        a.fromBufferAttribute(pos,idx?idx.getX(i):i);b.fromBufferAttribute(pos,idx?idx.getX(i+1):i+1);c.fromBufferAttribute(pos,idx?idx.getX(i+2):i+2);
        if(ray.intersectTriangle(a,b,c,false,hit)){
          // Only tread-like faces count as walkway: cliff sides and risers are not footing.
          e1.subVectors(b,a);e2.subVectors(c,a);nrm.crossVectors(e1,e2).normalize();
          if(topFacesOnly?nrm.dot(ray.direction)>-.6:Math.abs(nrm.dot(ray.direction))<.6)continue; // lake rejects underside ceilings
          hit.applyMatrix4(mesh.matrixWorld);const r=hit.length();if(r<=limit&&r>best)best=r;
        }
      }
    }
    return Number.isFinite(best)?best:null;
  };
}

// Generic form: any walkway network (e.g. the mother-port quay, connector, lift and upper walk).
export function createEdgeGuard(options){return createSwampEdgeGuard(options);}
export function createSwampEdgeGuard({getZone,supportRadius,toast=null,maxDrop=.7,leaveDrop=.15,networkDrop=7.5,rescueDrop=3,
  zoneRadius=50,zoneY=[-30,120],getNetworkMeshes=null,label='湖沼',
  enabled=new URLSearchParams(globalThis.location?.search||'').get('swampEdgeGuard')!=='0'}={}){
  const prev=new THREE.Vector3(),good=new THREE.Vector3(),stand=new THREE.Vector3(),safe=new THREE.Vector3(),local=new THREE.Vector3(),up=new THREE.Vector3();
  let refFromNetwork=false,hasGood=false,hasStand=false,standR=0,prevOnGround=false,prevGroundR=0,refR=null,hasSafe=false,safeR=0,airTime=0,lastToast=-1e9,clock=0,outside=0,lastRef=-1e9;
  let samplerZone=null,network=null;
  const report={enabled,version:2,maxDrop,networkDrop,rescueDrop,blockedSteps:0,allowedNetworkDrops:0,rescues:0,lastBlock:null,active:false,refR:null};
  function zoneOf(){
    const zone=getZone?.();if(!zone)return null;
    if(zone!==samplerZone){samplerZone=zone;network=getNetworkMeshes?createSwampNetworkSampler(zone,()=>getNetworkMeshes(zone),{topFacesOnly:false}):createSwampNetworkSampler(zone);hasSafe=false;refR=null;}
    return zone;
  }
  function inZone(zone,p){
    zone.updateWorldMatrix(true,false);local.copy(p);zone.worldToLocal(local);
    return Math.hypot(local.x,local.z)<zoneRadius&&local.y>zoneY[0]&&local.y<zoneY[1];
  }
  function say(text){if(toast&&clock-lastToast>6){lastToast=clock;toast(text);}}
  const atSupport=new THREE.Vector3();
  function networkAtSupport(pos,groundR){if(getNetworkMeshes)return network(pos,.4);if(!Number.isFinite(groundR))return null;atSupport.copy(pos).setLength(groundR+.01);return network(atSupport,.06);}
  function onNetwork(pos,groundR){const net=networkAtSupport(pos,groundR);return net!==null&&Math.abs(net-groundR)<.08;}
  // The pit's way out: where the canyon terrace beyond the rim is higher, a narrow crack
  // separates them and the original physics lifts the courier onto the terrace. Keep
  // allowing that crossing (ground at least as high as here within ~1.2 units ahead).
  const ahead=new THREE.Vector3();
  function exitAhead(pos){
    ahead.subVectors(pos,prev);up.copy(pos).normalize();ahead.addScaledVector(up,-ahead.dot(up));
    if(ahead.lengthSq()<1e-10)return false;
    ahead.normalize().multiplyScalar(1.2).add(pos);
    const s=supportRadius(ahead);
    if(Number.isFinite(s)&&s>=refR+1){report.exits=(report.exits||0)+1;return true;}
    return false;
  }
  function block(player,support,allowedDrop){
    const pos=player.position,vel=player.velocity;
    up.copy(pos).normalize();const vr=vel.dot(up),r=pos.length();
    if(prevOnGround&&prevGroundR<refR-allowedDrop-.05&&(hasSafe||hasStand)){
      // Already below the walkway (some path slipped through): go back up, never hold the courier down there.
      pos.copy(hasSafe?safe:stand);vel.set(0,0,0);player.onGround=true;player.groundR=hasSafe?safeR:standR;airTime=0;refR=player.groundR;
      report.rescues++;say('已回到'+label+'步道');return;
    }
    if(prevOnGround&&vr<=.6){
      pos.copy(prev);up.copy(pos).normalize();vel.set(0,0,0);player.onGround=true;player.groundR=prevGroundR;airTime=0;
    }else if(vr>0&&hasGood){
      // Rising part of a jump: keep the vertical arc over the last supported spot.
      pos.copy(good).setLength(r);up.copy(pos).normalize();vel.copy(up).multiplyScalar(vr);
    }else if(hasStand){
      // Slipping over a lip: put the feet back where they last stood on firm ground.
      pos.copy(stand);vel.set(0,0,0);player.onGround=true;player.groundR=standR;airTime=0;
    }else{
      pos.copy(prev).setLength(r);up.copy(pos).normalize();vel.copy(up).multiplyScalar(Math.min(vr,0));
    }
    report.blockedSteps++;report.lastBlock={drop:+(refR-support).toFixed(3),local:local.toArray().map(v=>+v.toFixed(2))};
    say(label+'边缘：前面会掉下去，沿步道走吧');
  }
  return {
    report,
    network:p=>{const z=zoneOf();return z?network(p):null;},
    begin(player){prev.copy(player.position);prevOnGround=!!player.onGround;prevGroundR=player.groundR;
      if(prevOnGround&&!hasStand){stand.copy(prev);standR=prevGroundR;hasStand=true;}},
    end(player,dt=1/120){
      clock+=dt;
      if(!report.enabled)return;
      const zone=zoneOf();
      if(!zone||!(inZone(zone,player.position)||inZone(zone,prev))){
        report.active=false;airTime=0;refR=null;refFromNetwork=false;report.refR=null;hasGood=false;hasStand=false;if((outside+=dt)>2)hasSafe=false;return;
      }
      report.active=true;outside=0;
      const pos=player.position,grounded=!!player.onGround;
      if(refR===null)refR=prevOnGround?prevGroundR:(grounded?player.groundR:prev.length());
      const support=grounded?player.groundR:supportRadius(pos);
      const landing=Number.isFinite(support)?support:-Infinity;
      // Off the walkway network the courier may still step down a little; leaving the
      // network itself onto lower, unmarked ground (crater wall, lip, canyon) is not allowed.
      const allowedDrop=refFromNetwork?leaveDrop:maxDrop;
      if(landing<refR-allowedDrop){
        const net=network(pos,.8);
        const landingNet=getNetworkMeshes?net:networkAtSupport(pos,landing);
        const landsOnNetwork=landingNet!==null&&Math.abs(landingNet-landing)<.4&&(getNetworkMeshes||prevOnGround?refR:Math.min(refR,prev.length()))-landingNet<=networkDrop;
        // A walkway tread slightly above the feet (e.g. the 0.4-high top stair across the
        // rim's entrance gap) is outside the authored sampler's -0.35 window: step onto it.
        const r=pos.length(),stepUp=net!==null&&net>=r-.05&&net-r<=.6&&net>=refR-maxDrop;
        if(stepUp&&(!landsOnNetwork||getNetworkMeshes)){
          pos.setLength(net);up.copy(pos).normalize();const vr=player.velocity.dot(up);if(vr<0)player.velocity.addScaledVector(up,-vr);
          player.onGround=true;player.groundR=net;refR=net;refFromNetwork=true;report.stepUps=(report.stepUps||0)+1;
          report.refR=refR;good.copy(pos);hasGood=true;stand.copy(pos);standR=net;hasStand=true;airTime=0;return;
        }
        if(!landsOnNetwork&&!exitAhead(pos)){report.lastLanding={landing,landingNet,net,refR,feet:pos.length()};block(player,landing,allowedDrop);report.refR=refR;return;}
        report.allowedNetworkDrops++;
        if(grounded){refR=player.groundR;refFromNetwork=true;lastRef=clock;}
      }else if(grounded&&clock-lastRef>.1){
        lastRef=clock;
        if(onNetwork(pos,player.groundR)){refR=player.groundR;refFromNetwork=true;safe.copy(pos);safeR=player.groundR;hasSafe=true;}
        else if(player.groundR>refR+leaveDrop||!refFromNetwork){refR=Math.max(refR,player.groundR);refFromNetwork=false;}
      }
      report.refR=refR;good.copy(pos);hasGood=true;
      if(grounded){airTime=0;stand.copy(pos);standR=player.groundR;hasStand=true;return;}
      airTime+=dt;
      const pendingNetwork=networkAtSupport(pos,landing);
      const descendingToNetwork=!getNetworkMeshes&&pendingNetwork!==null&&Math.abs(pendingNetwork-landing)<.08&&pos.length()-pendingNetwork<=networkDrop;
      if(hasSafe&&airTime>.6&&pos.length()<safeR-rescueDrop&&!descendingToNetwork){
        pos.copy(safe);player.velocity.set(0,0,0);player.onGround=true;player.groundR=safeR;airTime=0;refR=safeR;refFromNetwork=true;report.rescues++;
        say('已回到'+label+'步道');
      }
    }
  };
}
