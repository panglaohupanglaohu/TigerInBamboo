// =====================================================================
//  音频适配：订阅领域事件，按 surface/event 语义选脚步/战斗（G11）
//  不直接改 sfx.js；调用方传入 play(name)。
// =====================================================================

const FOOTSTEP = Object.freeze({
  waterfall: "foot-wet",
  shore: "foot-wet",
  cell: "foot-stone",
  building: "foot-stone",
  "terrace-top": "foot-grass",
});

export function footstepCue(semantic) {
  return FOOTSTEP[semantic] || "foot-grass";
}

export function combatCue(event) {
  if (!event) return null;
  if (event.type === "attack.hit") return "combat-hit";
  if (event.type === "attack.blocked") return event.shield ? "combat-block" : "combat-clang";
  if (event.type === "attack.miss") return "combat-miss";
  return null;
}

export function bindCombatAudio(bus, play) {
  if (!bus || typeof play !== "function") return () => {};
  return bus.on("combat", (ev) => {
    const cue = combatCue(ev);
    if (cue) play(cue, ev);
  });
}
