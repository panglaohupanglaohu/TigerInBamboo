/**
 * 958371606350454784 · ui.html「槽位表头像」运行验收（r177）。
 *
 * 片子：88 帧硬切，同构图蓝底单人肖像，脸形/发型/眉/眼/鼻/嘴/雀斑逐张变（联系表 9 行 × 10 列）。
 * 页面上对应 `?t=face&portrait=slots`：每张脸 = sampleSlots(partSeed(base,id)) → slot-portrait.js 逐槽派发。
 *
 * 本测试锁的是「数据接口 + 剪影 IoU」在**真页面**上的口径：
 *   - 页面报的 specs 必须等于用 partSeed 重算的 spec（对外数据接口）；
 *   - 画布剪影与 portraitSilhouette 掩码 IoU 接近 1（同一几何，不是两套画法）；
 *   - 同 seed 重画逐字节相同、换 seed 不同、切回来回位 0；
 *   - 窄屏列数从 4 变 3 时，同一格的身份（id → spec）不变。
 */
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const badResponses = [];
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) badResponses.push(`${r.status()} ${r.url()}`); });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/favicon/.test(text) || /Failed to load resource/.test(text)) return;   // 静态站无 favicon，不算页面报错
    errors.push(`console: ${text}`);
  });
  const out = {};
  try {
    await page.goto('http://localhost:8769/ui.html?t=face&portrait=slots');
    await page.waitForFunction(() => window.uiLab?.portraitStats?.mode === 'slots');

    /* 1. 账面读数 + 画布剪影 IoU */
    const wide = await page.evaluate(() => {
      const s = uiLab.portraitStats;
      return {
        mode: s.mode, drawn: s.drawn, slotKeys: s.slotKeys, hairVariants: s.hairVariants,
        diversity: s.diversity, meanIoU: s.meanIoU, canvasMaskIoU: s.canvasMaskIoU,
        specs: s.specs.map((p) => JSON.stringify(p)).length,
      };
    });
    if (wide.mode !== 'slots') throw new Error(`模式不是槽位表：${wide.mode}`);
    if (wide.drawn !== 8) throw new Error(`1440 宽应画 8 张，实为 ${wide.drawn}`);
    if (wide.slotKeys.join(',') !== 'bg,head,ear,hair,brow,eye,nose,mouth,marks') throw new Error('槽位键序变了');
    if (wide.hairVariants.length !== 5) throw new Error(`发型种类 ${wide.hairVariants.length}`);
    if (!(wide.canvasMaskIoU >= 0.95)) throw new Error(`画布剪影 vs 掩码 IoU 只有 ${wide.canvasMaskIoU}`);
    if (!(wide.diversity > 0.15)) throw new Error(`24 张剪影差异过低 ${wide.diversity}`);
    if (!(wide.meanIoU < 0.85)) throw new Error(`平均 IoU 过高（脸都一样）${wide.meanIoU}`);

    /* 2. 数据接口：页面报的 specs == partSeed 重算的 specs（逐张、逐字段） */
    const recomputed = await page.evaluate(async () => {
      const { sampleSlots, partSeed } = await import('./src/core/part-random.js');
      const base = 7, ids = [0, 1, 2, 3, 4, 5, 6, 7];
      return ids.map((id) => ({ id, seed: partSeed(base, id), parts: sampleSlots(partSeed(base, id)).parts }));
    });
    const pageSpecs = await page.evaluate(() => uiLab.portraitStats.specs);
    recomputed.forEach((r, i) => {
      const got = pageSpecs[i];
      if (JSON.stringify(got) !== JSON.stringify(r.parts)) throw new Error(`第 ${i} 张 spec 与重算不一致：${JSON.stringify(got)} vs ${JSON.stringify(r.parts)}`);
    });
    const identity = await page.evaluate(() => JSON.parse(document.getElementById('cface').dataset.partSeeds));
    if (identity.length !== 8) throw new Error(`partSeeds 条目 ${identity.length}`);
    identity.forEach(([id, seed], i) => { if (seed !== recomputed[i].seed) throw new Error(`第 ${i} 张 seed 身份漂移`); });

    /* 3. 画布身份：同 seed 重画逐字节相同、换 seed 不同、切回来回位。
     * 用 element screenshot 比 PNG 字节（getImageData 在 GPU 后端偶发读到半更新缓冲，
     * 本轮实测同一帧四次截图 0 差、getImageData 偶发 6.8 万像素假差，故以截图为准）。 */
    const shot = async (seed, path) => {
      await page.evaluate((s) => uiLab.setPartSeed(s), seed);
      await page.waitForFunction(() => true);
      const buf = await page.locator('#cface').screenshot(path ? { path } : {});
      return buf;
    };
    const a7 = await shot(7);
    const b7 = await shot(7);
    const c4242 = await shot(4242, 'artifacts/coverage/part-random-slots-seed4242-r177.png');
    const d7 = await shot(7, 'artifacts/coverage/part-random-slots-seed7-r177.png');
    const ink = await page.evaluate(() => {
      const cv = document.getElementById('cface'), g = cv.getContext('2d', { willReadFrequently: true });
      const px = g.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] > 8) n++;
      return { ink: n, w: cv.width, h: cv.height };
    });
    if (!a7.equals(b7)) throw new Error('同 seed 两次重画的截图不一致');
    if (a7.equals(c4242)) throw new Error('换 seed 画面没变');
    if (!a7.equals(d7)) throw new Error('切回原 seed 没回位');

    await page.screenshot({ path: 'artifacts/coverage/part-random-slots-r177.png' });

    /* 4. 窄屏：列数 4→3，同一格身份不变 */
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => uiLab.portraitStats.drawn === 6);
    const narrow = await page.evaluate(() => {
      const s = uiLab.portraitStats;
      return { drawn: s.drawn, canvasMaskIoU: s.canvasMaskIoU, identities: JSON.parse(document.getElementById('cface').dataset.partSeeds), specs: s.specs };
    });
    if (narrow.drawn !== 6) throw new Error(`窄屏应画 6 张，实为 ${narrow.drawn}`);
    if (!(narrow.canvasMaskIoU >= 0.95)) throw new Error(`窄屏 IoU ${narrow.canvasMaskIoU}`);
    // 窄屏 ids: row0 → 0,1,2；row1 → 4,5,6（id 由格位决定，与列数无关）
    const narrowIds = narrow.identities.map(([id]) => id).join(',');
    if (narrowIds !== '0,1,2,4,5,6') throw new Error(`窄屏 id 序列 ${narrowIds}`);
    narrow.identities.forEach(([id, seed]) => {
      const ref = recomputed.find((r) => r.id === id);
      if (!ref || ref.seed !== seed) throw new Error(`窄屏 id ${id} 身份漂移`);
    });
    if (JSON.stringify(narrow.specs[0]) !== JSON.stringify(pageSpecs[0])) throw new Error('窄屏首格内容变了');
    const box = await page.locator('#cface').boundingBox();
    if (box.width > 390) throw new Error(`窄屏画布溢出 ${box.width}`);
    await page.screenshot({ path: 'artifacts/coverage/part-random-slots-mobile-r177.png' });

    out.wide = wide; out.narrow = { drawn: narrow.drawn, ids: narrowIds, canvasMaskIoU: narrow.canvasMaskIoU };
    out.canvas = { identity: a7.equals(b7), across: !a7.equals(c4242), home: a7.equals(d7), ink: ink.ink, w: ink.w, h: ink.h, bytes: a7.length };
    if (errors.length) throw new Error(`页面报错：${errors.join(' | ')}`);
    if (badResponses.length) throw new Error(`资源 4xx：${badResponses.join(' | ')}`);
    fs.writeFileSync('artifacts/coverage/part-random-slots-r177.json', JSON.stringify(out, null, 1));
    console.log(`PASS 槽位表头像：${wide.drawn} 张/9 槽/5 发型，画布剪影 vs 掩码 IoU ${wide.canvasMaskIoU}，24 张差异 ${wide.diversity}（均 IoU ${wide.meanIoU}）`);
    console.log(`PASS 数据接口：8 张 spec 与 partSeed 重算逐字段一致，seed 身份 ${identity.map(([, s]) => s).join('/')}`);
    console.log(`PASS 画布：同 seed 两次截图逐字节相同（${a7.length} 字节 PNG）、换 seed 不同、切回回位；墨像素 ${ink.ink}（${ink.w}×${ink.h}）`);
    console.log(`PASS 窄屏 390：6 张 id ${narrowIds} 身份不变、IoU ${narrow.canvasMaskIoU}、画布 ${Math.round(box.width)}px`);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
