import * as THREE from 'three';
// 湖沼目标图（2026-10-11 定稿）：中央巨树的根在清澈水下放射状铺开、盘到湖底并顺斜坡爬上去。
// Greg 团队·异星生态（学 Patric Fallon）：根是这棵树"吃住"整个湖的证据——粗根贴底、末端变细、偶尔分叉，
// 水下呈深青侧面/局部浅青顶面；与水色分出轮廓（平涂顶点色，不受光照）。
// 全部根合并为一个网格 = 1 次绘制；根顶 y < 24.5（荷叶舟在 y≈25 水面，船道不受影响）。?swampTreeRoots=0 关闭。
const flag = k => new URLSearchParams(globalThis.location?.search || '').get(k) !== '0';
const MAX_ROOT_Y = 24.2;

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** 向下射线采样湖底/坑壁高度（inner 本地坐标）。 */
export function makeSwampFloorSampler(inner) {
  const targets = [];
  inner.traverse(o => { if (o.isMesh && /swamp-lake-floor|swamp-sinkhole-wall/.test(o.name)) targets.push(o); });
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(), p = new THREE.Vector3();
  const fallback = (x, z) => { const r = Math.hypot(x, z); return r < 12.5 ? 10.4 : 10.4 + (r - 12.5) * 1.45; };
  return (x, z) => {
    if (!targets.length) return fallback(x, z);
    o.set(x, 30, z); inner.localToWorld(o); d.set(x, 0, z); inner.localToWorld(d); d.sub(o).normalize();
    rc.set(o, d); rc.far = Infinity;
    const hit = rc.intersectObjects(targets, false)[0];
    if (!hit) return fallback(x, z);
    p.copy(hit.point); inner.worldToLocal(p); return p.y;
  };
}

// 把一条中心线扫成渐细六棱管；直接写入合并数组（位置、顶点色、索引）。
function sweep(out, pts, radii, sides, cTop, cSide) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const M = Math.max(6, pts.length * 2);
  const frames = curve.computeFrenetFrames(M, false);
  const base = out.pos.length / 3, P = new THREE.Vector3(), N = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i <= M; i++) {
    const s = i / M; curve.getPointAt(s, P);
    const fi = s * (radii.length - 1), i0 = Math.floor(fi), i1 = Math.min(radii.length - 1, i0 + 1);
    const r = radii[i0] + (radii[i1] - radii[i0]) * (fi - i0);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      N.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a)).normalize();
      // 根略扁：竖向压一点，贴着湖底铺开
      out.pos.push(P.x + N.x * r, P.y + N.y * r * .72, P.z + N.z * r);
      // Dark submerged side facets retain a readable root silhouette. Only
      // upward planes receive the pale aquatic ridge, avoiding a white tube.
      const plane=THREE.MathUtils.smoothstep(N.y,.05,.82);
      c.copy(cSide).lerp(cTop,plane).multiplyScalar(N.y<-.25?.82:1);
      out.col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < M; i++) for (let k = 0; k < sides; k++) {
    const a = base + i * sides + k, b = base + i * sides + (k + 1) % sides, a2 = a + sides, b2 = b + sides;
    out.idx.push(a, a2, b, b, a2, b2);
  }
}

// Root-zone colonies: narrow flexible blades emerge from one anchored base.
// This is a project art construction, not a claim about alien plant biology.
// Unequal patches leave most of the floor empty and never occupy swimming height.
function createRootMeadow(inner,ground,seed){
  const rand=rng(seed),pos=[],col=[],sites=[],dark=new THREE.Color(0x426f69),light=new THREE.Color(0x8aae95);
  const emit=(p,c)=>{pos.push(p.x,p.y,p.z);col.push(c.r,c.g,c.b);};
  for(let habitat=0;habitat<9;habitat++){
    const angle=habitat*2.399+.4,radius=10.8+(habitat%3)*3.1;
    for(let plant=0;plant<4;plant++){
      const a=angle+(rand()-.5)*.15,r=radius+(rand()-.5)*1.7,x=Math.cos(a)*r,z=Math.sin(a)*r,y=ground(x,z)+.025;
      if(y>18.2)continue;
      const height=Math.min(21.6-y,3.2+rand()*2.6);sites.push({base:[x,y,z],height,habitat});
      for(let blade=0;blade<5;blade++){
        const direction=a+blade*2.399,h=height*(.58+rand()*.42),bend=.30+rand()*.7;
        const point=(t,side)=>{const width=.12*Math.sin(Math.PI*t)*(.85+.15*Math.sin(blade));
          return new THREE.Vector3(x+Math.cos(direction)*bend*t*t-Math.sin(direction)*width*side,
            y+h*t,z+Math.sin(direction)*bend*t*t+Math.cos(direction)*width*side);};
        for(let k=0;k<6;k++){
          const t=k/6,u=(k+1)/6;
          for(const[v,side]of[[t,-1],[u,-1],[t,1],[t,1],[u,-1],[u,1]])
            emit(point(v,side),dark.clone().lerp(light,v*.72+(side<0?.1:0)));
        }
      }
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,fog:false}));
  mesh.name='swamp-tree-root-meadow';mesh.raycast=()=>{};inner.add(mesh);
  return {mesh,sites,triangles:pos.length/9,dispose(){mesh.removeFromParent();geometry.dispose();mesh.material.dispose();}};
}

export function installSwampTreeRoots({swamp, enabled = flag('swampTreeRoots'), count = 10, seed = 5309, topColor = 0x78a5a0, sideColor = 0x315d68} = {}) {
  const report = {enabled, version: 6, roots: 0, branches: 0, triangles: 0, drawCalls: 0, maxReach: 0, maxY: -Infinity, minY: Infinity};
  const inner = swamp?.userData?.inner || swamp;
  const trunk = inner?.getObjectByName?.('world-tree-trunk');
  if (!enabled || !trunk) return {report, update() {}};
  if(inner.userData.swampTreeRootHandle)return inner.userData.swampTreeRootHandle;
  (swamp.parent || swamp).updateWorldMatrix(true, true);
  const floorY = inner.userData.floorY ?? 10;
  // 树干底部中心（树干略倾斜，用几何包围盒底点换算到 inner 本地）
  trunk.geometry.computeBoundingBox();
  const bb = trunk.geometry.boundingBox;
  const baseC = trunk.localToWorld(new THREE.Vector3(0, bb.min.y + 3, 0)); inner.worldToLocal(baseC);
  const ws = new THREE.Vector3(); trunk.getWorldScale(ws); const iws = new THREE.Vector3(); inner.getWorldScale(iws);
  const R0 = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * .5 * (ws.x / iws.x);
  const ground = makeSwampFloorSampler(inner);
  const rnd = rng(seed);
  // Submerged buttress planes follow target v4: dark blue-green contour and brighter upward ridges.
  const cTop = new THREE.Color(topColor), cSide = new THREE.Color(sideColor);
  const out = {pos: [], col: [], idx: []};

  function growRoot(start, ang, L, r0, y0, depth) {
    const K = 22, pts = [], radii = [], wob = rnd() * 6.28, wobA = .12 + rnd() * .14;
    let reach = 0;
    for (let k = 0; k <= K; k++) {
      const s = k / K, d = s * L;
      const a = ang + Math.sin(s * 3.1 + wob) * wobA * s;
      const x = start.x + Math.cos(a) * d, z = start.z + Math.sin(a) * d;
      const r = r0 * Math.pow(1 - s, 1.15) + .07;
      const gy = ground(x, z);
      if (gy + r * 1.6 > MAX_ROOT_Y) break;          // 爬坡到近水面就停，船道不受影响
      const drop = 1 - THREE.MathUtils.smoothstep(s, depth ? 0 : .12, depth ? .32 : .70); // 从树干侧面拱出再落到湖底
      const y = Math.min(MAX_ROOT_Y-r,gy + r * .55 + Math.max(0, y0 - gy) * drop * drop);
      pts.push(new THREE.Vector3(x, y, z)); radii.push(r);
      reach = Math.max(reach, Math.hypot(x - baseC.x, z - baseC.z));
      report.maxY = Math.max(report.maxY, y + r); report.minY = Math.min(report.minY, y - r);
    }
    if (pts.length < 5) return null;
    sweep(out, pts, radii, depth ? 5 : 6, cTop, cSide);
    report.maxReach = Math.max(report.maxReach, reach);
    return {pts, radii, ang};
  }

  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + (rnd() - .5) * .5;
    const start = new THREE.Vector3(baseC.x + Math.cos(ang) * R0 * .55, 0, baseC.z + Math.sin(ang) * R0 * .55);
    const L = 15 + rnd() * 7.5;
    const root = growRoot(start, ang, L, 1.55 + rnd() * .50, MAX_ROOT_Y - .65, 0);
    if (!root) continue;
    report.roots++;
    if (root.pts.length > 10) {               // 少量分叉
      const j = Math.floor(root.pts.length * (.38 + rnd() * .2)), p = root.pts[j];
      const side = rnd() < .5 ? -1 : 1;
      const br = growRoot(new THREE.Vector3(p.x, 0, p.z), root.ang + side * (.45 + rnd() * .35), L * (.3 + rnd() * .15), root.radii[j] * .65, p.y, 1);
      if (br) {
        report.branches++;
        // A short fine fork gives each stout buttress a legible second scale,
        // merged into the same draw rather than another independent mesh.
        const fi=Math.floor(br.pts.length*.60),forkStart=br.pts[fi],forkRadius=br.radii[fi]*.36;
        const fork=[];
        for(let k=0;k<5;k++){
          const d=k*.42,a=br.ang-side*.48,x=forkStart.x+Math.cos(a)*d,z=forkStart.z+Math.sin(a)*d;
          const y=ground(x,z)+forkRadius*.55;
          if(y+forkRadius<MAX_ROOT_Y)fork.push(new THREE.Vector3(x,y,z));
        }
        if(fork.length>=3){sweep(out,fork,[forkRadius,.06],4,cTop,cSide);report.fineForks=(report.fineForks||0)+1;}
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
  geo.setIndex(out.idx); geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color: 0xffffff, vertexColors: true, fog: false}));
  mesh.name = 'swamp-tree-radial-roots';
  mesh.raycast = () => {};            // 纯视觉：不参与地面采样/拾取
  inner.add(mesh);
  report.triangles = out.idx.length / 3; report.drawCalls = 1;
  report.pigment={top:topColor,side:sideColor,model:'submerged teal facets'};
  report.shallowShoulders={top:MAX_ROOT_Y,waterClearance:.8,descentFraction:.70,shoulderFraction:.12};
  report.base = baseC.toArray().map(v => +v.toFixed(2)); report.trunkRadius = +R0.toFixed(2);
  const meadow=createRootMeadow(inner,ground,seed+403);report.meadow={sites:meadow.sites,triangles:meadow.triangles,drawCalls:1,topLimit:21.8};
  let disposed=false;
  const handle={report, mesh, update() {},dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();geo.dispose();mesh.material.dispose();meadow.dispose();delete inner.userData.swampTreeRootHandle;report.disposed=true;}};
  inner.userData.swampTreeRootHandle=handle;return handle;
}
