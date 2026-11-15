const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] }),
    p = await b.newPage({ viewport: { width: 1180, height: 900 } }), errors = [], reports = [],
    out = path.resolve(__dirname, '../artifacts/coverage'), base = process.env.REA_TEST_URL || 'http://localhost:8769';
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await p.goto(base + '/distances.html');
  await p.waitForFunction(() => window.distanceReview);

  const coarse = await p.evaluate(() => ({ spacing: distanceReview.spacing, levels: distanceReview.levels.length, segs: distanceReview.segs, closed: distanceReview.closed, max: distanceReview.field.max }));
  if (!coarse.segs || !coarse.closed) throw Error('等值线为空');
  await p.screenshot({ path: path.join(out, 'distance-isolines-default.png') });

  // 间距变粗 → 层数与线段数必须变少
  await p.fill('#spacing', '2.5');
  await p.dispatchEvent('#spacing', 'input');
  const dense = await p.evaluate(() => ({ levels: distanceReview.levels.length, segs: distanceReview.segs }));
  if (!(dense.levels < coarse.levels && dense.segs < coarse.segs)) throw Error('间距与线数不单调 ' + JSON.stringify({ coarse, dense }));

  // 参考片配色：只换线色/底色，几何不变
  await p.fill('#spacing', '1.25');
  await p.dispatchEvent('#spacing', 'input');
  await p.check('#ref');
  const sameGeom = await p.evaluate(() => ({ segs: distanceReview.segs, closed: distanceReview.closed }));
  await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(out, 'distance-isolines-reference-style.png') });
  if (sameGeom.segs !== coarse.segs) throw Error('换配色不应改几何');

  // 等值线必须落在可走格范围内（不跑到岛外海里）
  const outside = await p.evaluate(() => {
    const { out, mask, w, h } = distanceReview;
    let bad = 0;
    for (const L of out) for (const [x1, y1, x2, y2] of L.segments) for (const [x, y] of [[x1, y1], [x2, y2]]) {
      const cx = Math.round(x), cy = Math.round(y);
      if (cx < 0 || cy < 0 || cx >= w || cy >= h) bad++;
    }
    return bad;
  });
  if (outside) throw Error('等值线越出网格 ' + outside);

  reports.push({ coarse, dense, sameGeom, outside });
  fs.writeFileSync(path.join(out, 'distance-isolines-browser.json'), JSON.stringify({ reports, errors }, null, 2));
  await b.close();
  if (errors.length) throw Error(errors.join('\n'));
  console.log('PASS distance-isolines browser', JSON.stringify(reports));
})().catch((e) => { console.error(e); process.exit(1); });
