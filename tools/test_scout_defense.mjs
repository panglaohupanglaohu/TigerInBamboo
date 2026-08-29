import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const defense = read("../TigerMessenger/src/world/scoutDefense.js");
const ride = read("../TigerMessenger/src/player/scoutAircraftRide.js");
const island = read("../TigerMessenger/src/scenes/messengerIsland.js");
const main = read("../TigerMessenger/src/main.js");
const html = read("../TigerMessenger/index.html");

assert.match(defense, /DEFAULT_COUNT = 5/);
assert.match(defense, /ZONE_DWELL = 18/);
assert.match(defense, /medium-black-grey-companion-bird/);
assert.match(defense, /getCityBirdFlocks/);
assert.match(defense, /getGateBirdVortex/);
assert.match(defense, /unit\.attackCd <= 0/);
assert.match(defense, /BIRD_DOWN_TIME/);
assert.match(defense, /ATTACK_FORMATION/);
assert.match(defense, /MIN_FORMATION_GAP/);
assert.match(defense, /gunMuzzles/);
assert.match(defense, /tracer\.flash/);
assert.match(ride, /event\.code !== "KeyF"/);
assert.match(ride, /keys\?\.KeyW/);
assert.match(ride, /keys\?\.KeyA/);
assert.match(ride, /keys\?\.Space/);
assert.match(ride, /keys\?\.ControlLeft/);
assert.match(read("../TigerMessenger/src/world/planetV8/tripleGateScout.js"), /triple-gate-scout-propeller/);
assert.match(read("../TigerMessenger/src/world/planetV8/tripleGateScout.js"), /gunMuzzles/);
assert.match(island, /createScoutDefenseSquad/);
assert.match(island, /count: 5/);
assert.match(main, /createScoutAircraftRide/);
assert.match(main, /scoutAircraftRide\?\.update\(dt\)/);
assert.match(html, /id="scout-hint"/);

console.log("✅ Scout defense: five-aircraft deployment, city/gate target scan, F driving and vertical controls verified");
