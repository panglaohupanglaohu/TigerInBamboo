// Independent small-fixture audit; never builds the full game world.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'artifacts/pipeline/swamp-ground-review');
const base = 'http://127.0.0.1:8877/TigerMessenger';
const files = ['src/world/swampGround.js', 'src/world/moebiusSwamp.js', 'src/world/collision.js', 'src/main.js'];
const sources = Object.fromEntries(await Promise.all(files.map(async file => [file, await readFile(path.join(root, file), 'utf8')])));
const mainHelpers = sources['src/main.js'].match(/function activeSwampTiger\(\)[\s\S]*?(?=function animate\()/)?.[0];
if (!mainHelpers) throw Error('Cannot locate bounded main sampler helpers');
const browser = await chromium.launch({channel: 'chrome', headless: true});
let report;
try {
  const page = await browser.newPage();
  await page.route('**/swamp-review.html', route => route.fulfill({contentType: 'text/html', body:
    `<script type="importmap">{"imports":{"three":"${base}/vendor/three.module.js","three/addons/":"${base}/vendor/jsm/"}}</script>`}));
  await page.goto(base + '/swamp-review.html');
  report = await page.evaluate(async ({base, mainHelpers}) => {
    const T = await import('three');
    const {createSwampGroundSampler} = await import(base + '/src/world/swampGround.js');
    const {resolveCollisions} = await import(base + '/src/world/collision.js');
    const {PLANET_RADIUS} = await import(base + '/src/world/planet.js');
    const checks = [], observations = [];
    const check = (name, passed, detail) => checks.push({name, passed: !!passed, ...(detail === undefined ? {} : {detail})});
    const material = new T.MeshBasicMaterial({side: T.DoubleSide});
    function fixture(scale = new T.Vector3(.5, .5, .5), normal = new T.Vector3(0, 1, 0)) {
      const scene = new T.Scene(), wrap = new T.Group(), zone = new T.Group();
      wrap.position.copy(normal).multiplyScalar(PLANET_RADIUS + 1.43);
      wrap.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), normal);
      wrap.rotateY(.37); wrap.scale.copy(scale); zone.position.y = -40;
      scene.add(wrap); wrap.add(zone);
      const wall = new T.Mesh(new T.CylinderGeometry(34, 13, 30, 14, 4, true), material);
      wall.position.y = 25; zone.add(wall);
      const floor = new T.Mesh(new T.CylinderGeometry(13.5, 15, 1.2, 12), material);
      floor.position.y = 9.8; zone.add(floor);
      const surfaces = [wall, floor];
      for (let i = 0; i < 8; i++) {
        const fraction = i / 7, radius = 37 - fraction * 12;
        const step = new T.Mesh(new T.BoxGeometry(8.5, 1.2, 3.2), material);
        step.position.set(Math.cos(.5) * radius, 39.4 - fraction * 17.5, Math.sin(.5) * radius);
        step.rotation.set(.16, -.5, 0); zone.add(step); surfaces.push(step);
      }
      const decoration = new T.Mesh(new T.SphereGeometry(5, 6, 4), material);
      decoration.position.y = 70; zone.add(decoration);
      const outlineDecoration = new T.Mesh(new T.SphereGeometry(10, 6, 4), material);
      outlineDecoration.position.y = 60; floor.add(outlineDecoration);
      scene.updateMatrixWorld(true);
      const sample = createSwampGroundSampler(zone, surfaces);
      zone.userData.sampleGroundRadius = sample;
      const point = (x, y, z) => zone.localToWorld(new T.Vector3(x, y, z));
      return {scene, wrap, zone, floor, wall, surfaces, decoration, sample, point};
    }
    const cases = [fixture(), fixture(new T.Vector3(.5,.5,.5), new T.Vector3(.4,-.5,.7).normalize()),
      fixture(new T.Vector3(.7,.4,.6), new T.Vector3(-.6,.3,.7).normalize())];
    for (let n = 0; n < cases.length; n++) {
      const f = cases[n];
      const queries = [[0, 11, 0], [8, 18, 2], [20, 28, 4], [29, 42, 5], [34, 40, 19], [-23, 25, -10]];
      let maxError = 0, hits = 0;
      for (const xyz of queries) {
        const position = f.point(...xyz), saved = position.clone();
        const actual = f.sample(position);
        const direction = position.clone().normalize().negate();
        const origin = position.clone().normalize().multiplyScalar(position.length() + 100);
        const raycaster = new T.Raycaster(origin, direction);
        const hit = raycaster.intersectObjects(f.surfaces, false)[0];
        const expected = hit ? hit.point.length() : null;
        if (Number.isFinite(expected) && Number.isFinite(actual)) {hits++; maxError = Math.max(maxError, Math.abs(expected - actual));}
        else if (actual !== expected) maxError = Infinity;
        check('sampler does not mutate player position ' + n + ':' + xyz.join(','), position.equals(saved));
      }
      check('radial intersections match native raycast under fixture transform ' + n, hits >= 4 && maxError < 1e-6, {hits, maxError});
      check('outside footprint and height range fall back ' + n,
        f.sample(f.point(43,40,0)) === null && f.sample(f.point(0,-21,0)) === null && f.sample(f.point(0,121,0)) === null);
      check('opposite hemisphere is excluded ' + n, f.sample(f.point(0,40,0).negate()) === null);
      const position = f.point(0,11,0), before = f.sample(position);
      f.decoration.position.y = 120; f.scene.updateMatrixWorld(true);
      check('unlisted decorations and mesh children do not become ground ' + n, Math.abs(before - f.sample(position)) < 1e-9);
    }
    const f = cases[0], start = f.point(0,10.45,0), actualGround = f.sample(start);
    function collide(position, localGround, platforms = []) {
      const velocity = position.clone().normalize().multiplyScalar(-1);
      const player = {onGround: false}; let resets = 0;
      resolveCollisions(position, velocity, 1/120, platforms, player, () => resets++, {sampleRadius: () => PLANET_RADIUS + 1.43}, localGround);
      return {position, velocity, player, resets};
    }
    const vanilla = collide(start.clone(), null), local = collide(start.clone(), f.sample);
    check('local crater ground suppresses general planet shell pop', Math.abs(local.position.length() - actualGround) < 1e-6
      && vanilla.position.length() - local.position.length() > 5, {generalRadius: vanilla.position.length(), localRadius: local.position.length(), actualGround});
    const outside = f.point(44,40,0);
    const baseline = collide(outside.clone(), null), fallback = collide(outside.clone(), f.sample);
    check('pit-exterior collision is unchanged', baseline.position.distanceTo(fallback.position) < 1e-9
      && baseline.velocity.distanceTo(fallback.velocity) < 1e-9 && baseline.player.onGround === fallback.player.onGround);
    // Exercise the actual two small main helpers without importing/running main.
    const tiger = new T.Group(); tiger.userData.kind = 'moebius-swamp-tiger'; f.zone.add(tiger);
    const win = {__tmSwampTiger: tiger}; let findCalls = 0;
    const find = scene => {findCalls++; let result = null; scene.traverse(n => {if (!result && n.userData.kind === 'moebius-swamp-tiger') result = n;}); return result;};
    const helpers = new Function('scene', 'findSwampTiger', 'window', mainHelpers + '; return {activeSwampTiger, refreshSwampGroundZone, sampleSwampGround};')(f.scene, find, win);
    helpers.activeSwampTiger(); helpers.refreshSwampGroundZone();
    const attachedResult = helpers.sampleSwampGround(start);
    f.zone.remove(tiger); helpers.activeSwampTiger(); helpers.refreshSwampGroundZone();
    check('deleting tiger does not delete crater ground', Number.isFinite(helpers.sampleSwampGround(start)) && win.__tmSwampTiger === null);
    f.zone.add(tiger); helpers.activeSwampTiger();
    f.scene.remove(f.wrap);
    helpers.activeSwampTiger(); helpers.refreshSwampGroundZone();
    check('removed whole wrapper invalidates main cached sampler', Number.isFinite(attachedResult)
      && helpers.sampleSwampGround(start) === null && win.__tmSwampTiger === null);
    f.scene.add(f.wrap); helpers.activeSwampTiger(); helpers.refreshSwampGroundZone();
    const callsBeforeSubsteps = findCalls;
    for (let i=0; i<6; i++) helpers.sampleSwampGround(start);
    check('physics substeps never rescan the scene', findCalls === callsBeforeSubsteps);
    // Probe whether a platform's lateral push invalidates the precomputed radius.
    const slope = fixture(); slope.floor.rotation.z = .5; slope.scene.updateMatrixWorld(true);
    const slopedStart = slope.point(0,10.4,0);
    const blocker = {center: new T.Vector3(0, PLANET_RADIUS + 1.43, 0), normal: new T.Vector3(0,1,0),
      right: new T.Vector3(1,0,0), forward: new T.Vector3(0,0,1), half: new T.Vector3(1,15,1), topHeight: PLANET_RADIUS + 3};
    const pushed = collide(slopedStart.clone(), slope.sample, [blocker]);
    const radiusAtFinalPoint = slope.sample(pushed.position), residual = pushed.position.length() - radiusAtFinalPoint;
    observations.push({name: 'local radius after platform tangent push', residual, finalRadius: pushed.position.length(), radiusAtFinalPoint,
      onGround: pushed.player.onGround, position: pushed.position.toArray(), sourceQuery: slopedStart.toArray()});
    check('platform tangent push does not ground player on stale slope sample',
      !pushed.player.onGround || Math.abs(residual) < 1e-6, {residual, onGround: pushed.player.onGround});
    const crossingStart = new T.Vector3(0, PLANET_RADIUS - 13, 0);
    const intoLocal = collide(crossingStart.clone(), position => position.z > .5 ? PLANET_RADIUS - 15 : null, [blocker]);
    check('platform push entering local footprint resamples before generic shell', intoLocal.position.z > .5 && intoLocal.position.length() < PLANET_RADIUS,
      {position: intoLocal.position.toArray(), radius: intoLocal.position.length()});
    const outOfLocal = collide(crossingStart.clone(), position => position.z < .5 ? PLANET_RADIUS - 15 : null, [blocker]);
    check('platform push leaving local footprint restores generic shell', outOfLocal.position.z > .5 && Math.abs(outOfLocal.position.length() - (PLANET_RADIUS + 1.43)) < 1e-6,
      {position: outOfLocal.position.toArray(), radius: outOfLocal.position.length()});
    const triangleCount = f.surfaces.reduce((n,m)=>n+(m.geometry.index?.count ?? m.geometry.attributes.position.count)/3,0);
    for(let i=0;i<100;i++)f.sample(start);
    const timings=[];
    for(let i=0;i<1000;i++){const t=performance.now();f.sample(start);timings.push(performance.now()-t);}
    timings.sort((a,b)=>a-b);
    return {passed: checks.every(c=>c.passed), checks, observations,
      performance: {fixtureTriangles: triangleCount, calls: timings.length, medianMs: timings[500], p95Ms: timings[950], maxMs: timings.at(-1),
        meanMs: timings.reduce((a,b)=>a+b,0)/timings.length},
      scope: 'Small authored-shape fixtures and actual collision/main-helper code; no full-world construction or gameplay acceptance'};
  }, {base, mainHelpers});
  report.runtimeHashes = Object.fromEntries(Object.entries(sources).map(([file, text]) => [file, createHash('sha256').update(text).digest('hex')]));
  report.inputsUnchanged = (await Promise.all(files.map(async file => (await readFile(path.join(root,file),'utf8')) === sources[file]))).every(Boolean);
  report.passed &&= report.inputsUnchanged;
} catch(error) {report={passed:false,error:String(error.stack||error)};}
finally {await browser.close();}
await mkdir(output,{recursive:true});
await writeFile(path.join(output,'fixture-review.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks:report.checks?.length,failed:report.checks?.filter(c=>!c.passed),
  observations:report.observations,performance:report.performance,error:report.error,report:path.join(output,'fixture-review.json')}));
process.exitCode=report.passed?0:1;
