// Public name kept separate so production callers can depend on a focused
// module while tests import the shared compiler.
export { buildGeodesicWaterShell, validateCurvedWater } from "./curvedWaterCompiler.js";
