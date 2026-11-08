/** 球系统 · 验证（纯函数，Node 可测）：编译器自带检查 + 确定性复算 + 场景锚点 + 预算。 */
export function verifyPlanet(before, after, again) {
  const checks = [], add = (id, name, status, detail) => checks.push({ id, name, status, detail });
  if (!after.ok) {
    const hint = after.recipe?.subdivision > 1 ? '。网格细分 2 级以上目前过不了地形链检查，把「网格细分」调回 1 级或移出管线。' : '';
    add('compile', '编译', 'fail', (after.error || `停在 ${after.stage} 阶段`) + hint);
    return { status: 'fail', checks, summary: '候选星球编译失败' };
  }
  add('compile', '编译', 'pass', `${after.pipeline?.length || 8} 个阶段全部完成，${after.ms} ms`);
  const bad = Object.entries(after.reports).filter(([, r]) => !r.ok);
  add('reports', '编译器检查', bad.length ? 'fail' : 'pass', bad.length ? bad.map(([k, r]) => `${k}：${r.errors.join('、') || '未通过'}`).join('；') : `${Object.keys(after.reports).length} 项（接缝 / 全局约束 / 路线 / 战斗面 / 书店坡度…）通过`);
  const same = again?.ok && Object.keys(after.hashes).every((k) => after.hashes[k] === again.hashes[k]);
  add('determinism', '确定性', same ? 'pass' : 'fail', same ? '独立复算哈希一致' : '同一配方两次编译结果不同');
  const sea = after.recipe.seaLevel;
  const drowned = after.landmarks.filter((m) => !m.water && m.height <= sea);
  add('landmarks', '场景锚点', drowned.length ? 'fail' : 'pass', drowned.length ? `被海淹没：${drowned.map((m) => `${m.id}（高 ${m.height.toFixed(2)} ≤ 海平面 ${sea}）`).join('、')}` : `${after.landmarks.length} 个场景锚点都在原位，陆上场景都高于海平面`);
  const dLand = after.stats.land - before.stats.land;
  add('land', '陆地比例', Math.abs(dLand) > 0.3 ? 'warn' : 'pass', `${Math.round(before.stats.land * 100)}% → ${Math.round(after.stats.land * 100)}%`);
  add('budget', '编译预算', after.ms > 5000 ? 'fail' : after.ms > 2500 ? 'warn' : 'pass', `${before.ms} ms → ${after.ms} ms（游戏启动时同步编译）`);
  const status = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';
  return { status, checks, summary: checks.map((c) => `${c.name}${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗'}`).join(' ') };
}
