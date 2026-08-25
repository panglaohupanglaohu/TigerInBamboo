// Browser/Node-safe V8 Worker entry.  The compiler remains pure data and can
// therefore be tested through this same handler without a DOM.

import { compilePlanetV8 } from "../planet/planetCompilerV8.js";
import { createWorkerHandler, installProcgenWorker } from "./procgenWorker.js";

export const planetWorkerHandler = createWorkerHandler({
  runPlanet(payload, { seed }) {
    return compilePlanetV8({ ...(payload || {}), seed });
  },
  runSurface: async (payload) => payload,
  runWfc: async (payload) => payload,
  runField: async (payload) => payload,
});

if (typeof self !== "undefined" && self.postMessage) installProcgenWorker(self, planetWorkerHandler);
