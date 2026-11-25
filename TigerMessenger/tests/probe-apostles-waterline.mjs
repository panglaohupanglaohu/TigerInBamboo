// 一次性探针：apostles approved 外观下，front-left 岩体水线带顶点分布。
// 排查 apostles-look-views 的「找不到水线上的崖脚点」是网格回归还是探针门槛问题。
import { launch, openApostles, waitApostlesStable, gameFrame } from './lib/apostles-e2e.mjs';

const browser = await launch();
const { ctx, page } = await openApostles(browser, { look: 'approved', errors: [] });
const w = await waitApostlesStable(page, { need: 3 });
console.log('stable', JSON.stringify({ ok: w.ok, count: w.sample?.count }));

const out = await gameFrame(page).evaluate(() => {
  const rocks = [];
  globalThis.__tm.scene.traverse((o) => { if (o.userData?.apostleMass && o.geometry?.attributes?.position) rocks.push(o); });
  const rock = rocks.find((r) => r.userData.apostleMass === 'front-left') || rocks[0];
  const r = rock.userData.reacode || {};
  const S = r.scale || rock.scale.y || 1;
  const anchor = rock.userData.seaStack?.seaAnchor, Rw = anchor ? Math.hypot(...anchor) : 160;
  const bend = S / (2 * Rw);
  const pos = rock.geometry.attributes.position;
  const hist = {}; let inBand = 0, below = 0, above = 0, min = 1e9, max = -1e9;
  const lo = 0.1 / S, hi = 1.5 / S;
  const lows = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), yu = pos.getY(i) + bend * (x * x + z * z);
    if (yu < min) min = yu; if (yu > max) max = yu;
    const b = Math.floor(yu * S * 10) / 10; hist[b] = (hist[b] || 0) + 1;
    if (yu < lo) { below++; if (lows.length < 40 && yu > lo - 0.3 / S) lows.push(+yu.toFixed(4)); }
    else if (yu > hi) above++; else inBand++;
  }
  // 同分布但按 i+=3 步长（探针实际扫描口径）
  let s3 = 0;
  for (let i = 0; i < pos.count; i += 3) { const x = pos.getX(i), z = pos.getZ(i), yu = pos.getY(i) + bend * (x * x + z * z); if (yu >= lo && yu <= hi) s3++; }
  return { id: rock.userData.apostleMass, S, Rw, bend, count: pos.count, band: [+lo.toFixed(4), +hi.toFixed(4)], inBand, s3InBand: s3, below, above, min: +min.toFixed(3), max: +max.toFixed(3), lows, histLow: Object.fromEntries(Object.entries(hist).filter(([k]) => +k < 2)) };
});
console.log(JSON.stringify(out, null, 1));
await ctx.close(); await browser.close();
