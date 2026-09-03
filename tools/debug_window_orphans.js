// =====================================================================
// 悬空窗户定位脚本（2026-09-02）
// 用法：浏览器控制台整段粘贴。只读，不改场景。
//
// 目的：高山圣城仍有窗户在画（宿主链可见），但看起来悬在空中。
// 本脚本按「宿主链」聚合，指认这些窗到底挂在哪个节点上。
// =====================================================================
(() => {
  const s = __tm.scene;
  const THREE = __tm.THREE;

  const hosts = [];
  s.traverse((o) => {
    if (o.userData?.windowInstances) hosts.push(o);
  });
  console.log(`找到 ${hosts.length} 座带窗实例表的城堡`);

  for (const host of hosts) {
    const inst = host.userData.windowInstances;
    const dark = inst.dark;
    const lit = inst.lit;
    console.group(`%c${host.name}`, "color:#4ea1ff;font-weight:bold");
    console.log(`records=${inst.records.length}  dark.count=${dark.count}  lit.count=${lit.count}`);

    // 仍在画的窗（宿主祖先链全可见）
    const drawn = inst.records.filter((r) => {
      let n = r.mesh?.parent;
      while (n) { if (!n.visible) return false; if (n === host) break; n = n.parent; }
      return true;
    });
    console.log(`宿主链可见 = ${drawn.length} 扇`);

    // 按宿主链聚合：哪一类节点贡献了这些窗
    const byChain = new Map();
    for (const r of drawn) {
      const chain = [];
      let n = r.mesh?.parent;
      while (n && n !== host) {
        // 名字里的数字归一化，便于聚合（town-cell-3-7 → town-cell-#）
        chain.push((n.name || n.type).replace(/[-_]?\d+/g, "#"));
        n = n.parent;
      }
      const key = chain.join(" ← ") || "(直接挂在 host 下)";
      byChain.set(key, (byChain.get(key) || 0) + 1);
    }
    console.log("按宿主链聚合：");
    console.table([...byChain.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([chain, count]) => ({ 宿主链: chain, 窗数: count })));

    // 抽样：这些窗的宿主自己有没有可见的实体网格？
    // 若「同级可见网格 = 0」，说明窗挂在一个空壳节点上 —— 那就是悬空的成因。
    const sample = drawn.slice(0, 8).map((r) => {
      const parent = r.mesh.parent;
      let siblingMeshes = 0;
      parent?.children?.forEach((c) => {
        if (c !== r.mesh && c.visible && (c.isMesh || c.isInstancedMesh)) siblingMeshes++;
      });
      const p = new THREE.Vector3();
      r.mesh.getWorldPosition(p);
      return {
        窗: r.mesh.name || r.mesh.type,
        宿主: parent?.name || parent?.type,
        同级可见网格: siblingMeshes,
        世界位置: `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`,
        houseId: r.houseId ?? "-",
        cell: `${r.cellIx ?? "-"},${r.cellIy ?? "-"},${r.cellIz ?? "-"}`,
      };
    });
    console.log("抽样（同级可见网格 = 0 即为悬空）：");
    console.table(sample);
    console.groupEnd();
  }

  console.log("%c提示：把上面两张表截图发回即可。", "color:#8a8");
})();
