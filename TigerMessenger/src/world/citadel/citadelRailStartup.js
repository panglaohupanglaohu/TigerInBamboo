import {createCitadelRailSpliceSet} from './citadelRailSplice.js';

const LANES = ['center', 'red', 'blue'];

/** Startup-only composition, before track geometry, vehicles, stops or signals
 * exist. Route clearance is the plan author's responsibility; composition is
 * not acceptance. Never partially replace one lane if another fails. */
export function prepareCitadelRailStartup(sourceCurves, specifications) {
  const original = {center: sourceCurves.center, red: sourceCurves.red, blue: sourceCurves.blue};
  if (!specifications) return {curves: original, splice: null, report: {status: 'original', installed: false}};
  try {
    if (!LANES.every(key => specifications[key])) throw new Error('Explicit center, red and blue replacement specifications are required');
    const lanes = Object.fromEntries(LANES.map(key => [key, {...specifications[key], sourceCurve: original[key]}]));
    const splice = createCitadelRailSpliceSet({lanes});
    return {curves: splice.curves, splice, report: {
      status: 'composed-before-construction', installed: false,
      routes: splice.report, routeClearanceVerified: false,
    }};
  } catch (error) {
    return {curves: original, splice: null, report: {
      status: 'rejected-original-preserved', installed: false,
      error: {code: error.code || 'INVALID_STARTUP_PLAN', message: error.message, details: error.details || null},
    }};
  }
}
