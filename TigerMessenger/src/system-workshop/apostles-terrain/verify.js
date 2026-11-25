/**
 * 十二门徒地形管线 · 验证（验证 Worker 里跑，只读，独立重算，不相信改造 Worker 的输出）：
 *   开关组合合法 / 与管线步骤一一对应 / 不写存档与默认（persist=false，计划里只有开关和指标）/ 作用场景是十二门徒，
 *   软坡台阶复算一致、软坡能不能起作用（可融台阶占比）、配色差复算一致、色变幅度。
 * 复算直接调库函数（slopeMask、oklab），但走自己的循环，不调用 capabilities.js 的统计函数。
 */
import { slopeMask } from '../../../../townscaper-web/REACodeRefactoring/src/terrain/generate.js';
import { TERRAIN } from '../../../../townscaper-web/REACodeRefactoring/src/core/palette.js';
import { hexToOklab, deltaE } from '../../../../townscaper-web/REACodeRefactoring/src/core/oklab.js';

const ALLOWED_KEYS = new Set(['flags', 'look', 'lookId', 'persist', 'metrics']);
const FLAG_OF = { 'apostles.soft': 'soft', 'apostles.palette': 'palette' };

function recountSoft(site) {
  const t = { land: 0, soft1: 0, sharp1: 0, cliff2: 0 };
  for (const m of site.masses || []) {
    if (m.missing || !Array.isArray(m.lv)) continue;
    const mask = slopeMask(m.lv.map((_, i) => ({ cx: m.xz[2 * i], cz: m.xz[2 * i + 1] })), m.seed);
    t.land += m.lv.filter((v) => v > 0).length;
    for (let k = 0; k < m.edges.length; k += 2) { const a = m.edges[k], b = m.edges[k + 1], d = Math.abs(m.lv[a] - m.lv[b]); if (d === 1) { if (mask[a] < 0.5 && mask[b] < 0.5) t.soft1++; else t.sharp1++; } else if (d > 1) t.cliff2++; }
  }
  return t;
}
function recountPalette(site) {
  const v = [];
  for (const m of site.masses || []) for (const [hex, ref] of [[m.colors?.top, TERRAIN.grass], [m.colors?.wall, TERRAIN.rock]]) if (hex && /^#[0-9a-f]{6}$/i.test(hex)) v.push(+deltaE(hexToOklab(hex), hexToOklab(ref)).toFixed(3));
  return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3) : null;
}

export function verifyApostlesTerrain(site, plan, { steps = [] } = {}) {
  const checks = [], add = (id, name, status, detail) => checks.push({ id, name, status, detail });
  const flags = Array.isArray(plan?.flags) ? plan.flags : null;
  const canonical = flags ? ['soft', 'palette'].filter((f) => flags.includes(f)).join(',') : null;
  const okFlags = !!flags && flags.length > 0 && new Set(flags).size === flags.length && flags.every((f) => f === 'soft' || f === 'palette') && plan.look === canonical && plan.lookId === [...flags].sort().join('+');
  add('flags', '开关组合', okFlags ? 'pass' : 'fail', okFlags ? `候选 ?apostlesLook=${plan.look}` : `开关组合无效：flags=${JSON.stringify(plan?.flags)} look=${plan?.look} lookId=${plan?.lookId}`);
  const want = [...new Set(steps.map((s) => FLAG_OF[s.id]).filter(Boolean))].sort().join('+'), got = flags ? [...flags].sort().join('+') : '';
  add('steps', '与管线步骤对应', want === got ? 'pass' : 'fail', want === got ? `${steps.length} 步 → ${got}` : `管线步骤要的是 ${want || '无'}，候选给的是 ${got || '无'}`);
  const extra = plan ? Object.keys(plan).filter((k) => !ALLOWED_KEYS.has(k)) : ['(无计划)'], size = JSON.stringify(plan ?? null).length;
  const noSave = !!plan && plan.persist === false && !extra.length && size < 200000;
  add('nosave', '不写存档 / 不改默认', noSave ? 'pass' : 'fail', noSave ? '候选只是一组外观开关：预览用网址参数重载游戏 iframe，不写 tm.apostles.look.v1、不动岩体存档和湖上建筑' : `计划里有不该有的东西：${extra.join('、') || ''}${plan?.persist !== false ? ' persist≠false' : ''}${size >= 200000 ? ' 体积 ' + size : ''}`);
  const masses = (site?.masses || []).filter((m) => !m.missing);
  add('scope', '作用在十二门徒', site?.scene === 'apostles' && masses.length ? 'pass' : 'fail', `${site?.scene || '未知场景'} · ${masses.length} 块岩体有数据`);
  if (checks.some((c) => c.status === 'fail' && c.id !== 'steps')) return finish(checks);
  if (flags.includes('soft')) {
    const t = recountSoft(site), m = plan.metrics?.soft?.total || {};
    const same = ['land', 'soft1', 'sharp1', 'cliff2'].every((k) => m[k] === t[k]);
    add('soft-recount', '软坡台阶复算', same ? 'pass' : 'fail', same ? `可融 ${t.soft1} · 陡崖省 1 层 ${t.sharp1} · 竖崖 ${t.cliff2}（${t.land} 个陆地格）` : `复算 ${JSON.stringify(t)} 与候选 ${JSON.stringify(m)} 不一致`);
    const steps3 = t.soft1 + t.sharp1 + t.cliff2, share = steps3 ? t.soft1 / steps3 : 0;
    add('soft-effect', '软坡能不能起作用', share >= 0.05 ? 'pass' : 'warn', `可融台阶占全部台阶 ${(share * 100).toFixed(1)}%${share < 0.05 ? '：几乎没有可融的 1 层台阶，画面会接近现状（诊断结论 3：高度场是平顶 + 2 层起跳）' : ''}`);
  }
  if (flags.includes('palette')) {
    const mean = recountPalette(site), m = plan.metrics?.palette?.mean ?? null;
    const same = mean === m || (mean != null && m != null && Math.abs(mean - m) < 1e-6);
    add('palette-recount', '配色差复算', same ? 'pass' : 'fail', same ? `平均 ΔE ${mean ?? '—'}` : `复算 ${mean} 与候选 ${m} 不一致`);
    if (mean != null) add('palette-shift', '色变幅度', mean <= 25 ? 'pass' : 'warn', `现画面离库地形色平均 ΔE ${mean}${mean > 25 ? '：变化很大，必须看同机位对照图再决定' : ''}`);
  }
  return finish(checks);
}
function finish(checks) {
  const status = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';
  return { status, checks, summary: checks.map((c) => `${c.name}${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗'}`).join(' ') };
}
