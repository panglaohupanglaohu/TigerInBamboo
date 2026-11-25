/** 战役管线 · 验证 Worker 用的独立检查（纯数据）。R34–R36：导航能力的检查在 nav-verify.js（从 site.nav 独立重算）。 */
import { verifyNavigation } from './nav-verify.js?v=nav-r1';
export function verifyBattle(site, plan, { steps = [] } = {}) {
  const checks = [], add = (id, name, status, detail, blame) => checks.push({ id, name, status, detail, blame: blame || [] });
  const ids = new Set(steps.map((s) => s.id));

  add('site', '战场可用', !site ? 'fail' : site.land >= 40 ? 'pass' : site.land >= 15 ? 'warn' : 'fail',
    !site ? '没有舞台采样数据' : `陆地 ${site.land} 格 · 最高 ${site.maxLevel} 层 · 小屋 ${site.houses}`, ['battle.stage']);
  if (site) add('houses', '防守目标', site.houses >= 1 ? 'pass' : 'fail',
    site.houses >= 1 ? `${site.houses} 个小屋 / 台地目标` : '没有小屋或台地，维京人没有进攻目标', ['battle.stage']);

  const st = plan || {}, g = plan?.garrison || {}, w = plan?.waves || {};
  add('scale', '舞台尺度', st.scale >= 2 && st.scale <= 10 && st.gridRadius >= 10 && st.gridRadius <= 24 ? 'pass' : 'fail',
    ids.has('battle.stage') ? `${st.scale} 米/格 · 半径 ${st.gridRadius} 格` : '未部署舞台', ['battle.stage']);
  if (site && st.gridRadius) {
    const cover = site.land / (site.cells || 1);
    add('cover', '舞台覆盖', cover > 0.01 ? 'pass' : 'warn',
      `采样命中陆地 ${site.land}/${site.cells} 格`, ['battle.stage']);
  }

  if (ids.has('battle.garrison')) {
    const troops = (g.squads || 0) * (g.size || 0);
    add('garrison', '守军规模', troops <= 60 ? 'pass' : troops <= 90 ? 'warn' : 'fail',
      `增援 ${g.squads} 队 × ${g.size} 人 = ${troops} 人（装备 ${g.tier} 级）`, ['battle.garrison']);
  }
  if (ids.has('battle.waves')) {
    add('waves', '波次节奏', w.interval >= 8 && w.first <= 15 ? 'pass' : 'fail',
      `首波 ${w.first}s · 间隔 ${w.interval}s`, ['battle.waves']);
  }
  verifyNavigation(site, plan, ids, add);
  const status = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';
  return { status, checks, summary: checks.map((c) => `${c.name}${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗'}`).join(' ') };
}
