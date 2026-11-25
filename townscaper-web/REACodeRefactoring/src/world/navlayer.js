import {ladderAnchors} from '../core/ladder-profile.js';
import {ladderChannel} from './climb-route.js';
/**
 * navlayer.js — 把 navgraph 画出来：
 *   楼梯（默认开）：落差 1 层的区域之间一架三级台阶，贴着高的那一侧崖壁（1181464374839521280）
 *   导航图调试（toggle 'nav'）：最短路树 —— 颜色 = 从起点走过去的时间（青 → 橙），
 *     河上的边是白色、并且明显"更远也更快"；区域节点 = 白点（1582293326815862786 / 1795831296952041691）
 */

import * as THREE from 'three';
import { buildNav } from './navgraph.js';

export class NavLayer {
  constructor({ scene, levelHeight = 0.5 }) {
    this.L = levelHeight;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.stairs = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0xbfb197, roughness: 0.95, flatShading: true }));
    this.stairs.castShadow = true; this.stairs.receiveShadow = true;
    this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.9 }));
    this.nodes = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffffff, size: 7, sizeAttenuation: false, depthTest: false }));
    this.lines.renderOrder = this.nodes.renderOrder = 20;
    this.lines.visible = this.nodes.visible = false;
    this.group.add(this.stairs, this.lines, this.nodes);
    this.nav = null;this.woodLadders=false;this.ladderDiagnostics=[];
    // 917405214638006273：片子里的调试层是「每格一个点 + 黄线连到邻格」的可走图（统一黄、无渐变），
    // 不是最短路树。两种画法共用同一批 LineSegments/Points，靠 walkGraph 切。
    this.walkGraph=false;this._world=null;this._shape=null;this.walkStats=null;
  }

  set showGraph(on) { this.lines.visible = this.nodes.visible = on; }
  set showStairs(on) { this.stairs.visible = on; }
  set walk(on) { this.walkGraph = on; this.nodes.material.color.set(on ? 0xffe23a : 0xffffff); if (this._world) this.refresh(this._world, this._shape); }

  refresh(world, shape) {
    this._world = world; this._shape = shape;
    const nav = (this.nav = buildNav(world));
    const L = this.L;this.ladderDiagnostics=[];this.stairs.material.color.set(this.woodLadders?0x85664c:0xbfb197);
    const at = (p, s) => (shape ? shape.at(p, s) : [p.x, p.z]);

    // ---- 楼梯 ----
    const box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    const bp = box.attributes.position.array, bn = box.attributes.normal.array;
    const pos = [], nor = [];
    const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
    const rod=(a,b,thickness)=>{
      const dir=new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z),length=dir.length();dir.normalize();
      let side=new THREE.Vector3().crossVectors(dir,new THREE.Vector3(0,1,0));if(side.length()<1e-6)side.set(1,0,0);side.normalize();const forward=new THREE.Vector3().crossVectors(side,dir).normalize();
      m.makeBasis(side,dir,forward);m.scale(new THREE.Vector3(thickness,length,thickness));m.setPosition((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);nm.getNormalMatrix(m);
      for(let j=0;j<bp.length;j+=3){v.set(bp[j],bp[j+1],bp[j+2]).applyMatrix4(m);pos.push(v.x,v.y,v.z);v.set(bn[j],bn[j+1],bn[j+2]).applyMatrix3(nm).normalize();nor.push(v.x,v.y,v.z);}
    };
    for (const s of nav.stairs) {
      const c = s.low, h = nav.hgt[c.id], i = s.edge;
      // 崖壁经过笼形变形，底部比顶边更往外：贴着墙脚（切面 h）放，否则会埋进墙里；锚点与 node 检查共用 ladderAnchors
      const an = ladderAnchors(s, h, { at, L });
      if (!an) continue;
      const { mx, mz, ux, uz, len, vx, vz } = an;
      const rise = s.rise || 1, width = Math.min(0.36, len * 0.6), steps = rise * 3, depth = 0.11;
      if(this.woodLadders){
        // 与 climb-route（单位攀爬轨迹）同一份通道数据：锚点/剖面/接触不各算一套。
        const ch=ladderChannel(this._world,nav,s,{at,L});
        if(!ch.profile){this.ladderDiagnostics.push({cell:c.id,edge:i,contact:ch.contact});continue;}
        this.ladderDiagnostics.push({cell:c.id,edge:i,...ch.profile,contact:ch.contact});for(const rail of ch.profile.rails)rod(rail.a,rail.b,.018);for(const rung of ch.profile.rungs)rod(rung.a,rung.b,.014);continue;
      }
      for (let k = 0; k < steps; k++) {
        const top = h * L + (rise * L * (steps - k)) / steps;          // 最靠墙的一级最高
        const cx = mx + vx * (depth * (k + 0.5)), cz = mz + vz * (depth * (k + 0.5));
        const y0 = h * L - 0.02;
        m.makeBasis(v.set(ux / len, 0, uz / len), new THREE.Vector3(0, 1, 0), new THREE.Vector3(vx, 0, vz));
        m.scale(new THREE.Vector3(width, top - y0, depth));
        m.setPosition(cx, (top + y0) / 2, cz);
        nm.getNormalMatrix(m);
        for (let j = 0; j < bp.length; j += 3) {
          v.set(bp[j], bp[j + 1], bp[j + 2]).applyMatrix4(m); pos.push(v.x, v.y, v.z);
          v.set(bn[j], bn[j + 1], bn[j + 2]).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
        }
      }
    }
    box.dispose();
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    this.stairs.geometry.dispose(); this.stairs.geometry = sg;

    // ---- 最短路树 / 可走图 ----
    if (this.walkGraph) {
      // 917405214638006273 的调试层：每个可走格一个点（格心），到每个可走邻格一根黄线；
      // 端点各用自己的站立高度，所以跨台阶的那根线自然立起来（片子里塔身上那几根竖线就是它）。
      const lp = [], lc = [], YEL = [1, 0.886, 0.227], np = [];
      let edges = 0, steps = 0;
      for (const c of world.cells) {
        if (!nav.walk[c.id]) continue;
        np.push(c.cx, nav.hgt[c.id] * L + 0.06, c.cz);
        for (const id of c.edgeNeighbors) {
          if (id < 0 || id < c.id || !nav.walk[id]) continue;      // 每条边只画一次
          const o = world.cells[id];
          lp.push(c.cx, nav.hgt[c.id] * L + 0.06, c.cz, o.cx, nav.hgt[id] * L + 0.06, o.cz);
          lc.push(...YEL, ...YEL);
          edges++; if (nav.hgt[c.id] !== nav.hgt[id]) steps++;
        }
      }
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
      this.lines.geometry.dispose(); this.lines.geometry = lg;
      const ng = new THREE.BufferGeometry();
      ng.setAttribute('position', new THREE.Float32BufferAttribute(np, 3));
      this.nodes.geometry.dispose(); this.nodes.geometry = ng;
      const walkCells = world.cells.filter((c) => nav.walk[c.id]).length;
      this.walkStats = { cells: walkCells, nodes: np.length / 3, edges, stepEdges: steps };
      return nav;
    }

    const { parent, time } = nav.tree;
    let tmax = 0;
    for (const t of time) if (Number.isFinite(t)) tmax = Math.max(tmax, t);
    const lp = [], lc = [], cA = new THREE.Color(0x3fd6d0), cB = new THREE.Color(0xff8a3d), cR = new THREE.Color(0xffffff), col = new THREE.Color();
    for (const c of world.cells) {
      const p = parent[c.id];
      if (p < 0) continue;
      const q = world.cells[p];
      const river = world.river[c.id] && world.river[p];
      col.copy(river ? cR : cA).lerp(river ? cR : cB, Math.min(1, time[c.id] / (tmax || 1)));
      lp.push(q.cx, nav.hgt[p] * L + 0.06, q.cz, c.cx, nav.hgt[c.id] * L + 0.06, c.cz);
      lc.push(col.r, col.g, col.b, col.r, col.g, col.b);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
    this.lines.geometry.dispose(); this.lines.geometry = lg;

    const np = [];
    for (const r of nav.regions) np.push(r.cx, r.h * L + 0.1, r.cz);
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(np, 3));
    this.nodes.geometry.dispose(); this.nodes.geometry = ng;
    return nav;
  }
}
