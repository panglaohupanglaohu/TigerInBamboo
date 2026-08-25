// =====================================================================
//  攻城导演 + 木马规则（G7）：只发命令，不瞬移、不越战术图
// =====================================================================

export const SIEGE_ORDERS = Object.freeze([
  "land",
  "gather",
  "probe",
  "breach",
  "seize-gate",
  "climb",
  "push",
  "retreat",
]);

export const DEFEND_ORDERS = Object.freeze(["hold-high", "choke", "reserve", "fall-back", "counter"]);

export const TROJAN_RULES = Object.freeze({
  ropes: 4,
  dropsPerRope: 2,
  squads: 2,
  torchEnds: true,
  captureTarget: "castle-top",
  assaultRoutes: Object.freeze(["stairs", "interior-rotating-stairs"]),
  ladderPolicy: "disabled",
  ladderTerraces: Object.freeze([]),
  stairTerraces: Object.freeze([0]),
  captureMode: "interior-rotating-stairs",
  returnAtDawn: true,
});

export function createSiegeDirector() {
  let attack = "land";
  let defend = "hold-high";
  const log = [];
  return {
    get attack() {
      return attack;
    },
    get defend() {
      return defend;
    },
    issueAttack(next) {
      if (!SIEGE_ORDERS.includes(next)) throw new Error(`invalid attack order ${next}`);
      log.push({ side: "attack", from: attack, to: next });
      attack = next;
      return { type: next, teleport: false, skipGraph: false };
    },
    issueDefend(next) {
      if (!DEFEND_ORDERS.includes(next)) throw new Error(`invalid defend order ${next}`);
      log.push({ side: "defend", from: defend, to: next });
      defend = next;
      return { type: next, teleport: false, skipGraph: false };
    },
    log: () => log.slice(),
  };
}

export function assignSearchTargets(squadIds, doors) {
  const ids = [...squadIds].sort();
  const sortedDoors = [...doors].sort((a, b) => (a.id < b.id ? -1 : 1));
  const sectors = ids.map((id, i) => ({
    agentId: id,
    doors: sortedDoors.filter((_, di) => di % ids.length === i),
  }));
  return sectors;
}

export function nextTerrace(current, rules, squad) {
  const seq = squad === "ladder" ? rules.ladderTerraces : rules.stairTerraces;
  const i = seq.indexOf(current);
  if (i < 0 || i === seq.length - 1) return null;
  return seq[i + 1];
}

export function makeTrojanWave(rules = TROJAN_RULES) {
  const soldiers = [];
  const perSquad = (rules.ropes * rules.dropsPerRope) / rules.squads;
  for (let rope = 0; rope < rules.ropes; rope++) {
    for (let drop = 0; drop < rules.dropsPerRope; drop++) {
      const i = soldiers.length;
      const squad = rope < rules.ropes / 2 ? "ladder" : "stairs";
      const local = i % perSquad;
      const end = rules.torchEnds && (local === 0 || local === perSquad - 1);
      soldiers.push({
        id: `trojan:${rope}:${drop}`,
        rope,
        drop,
        squad,
        role: end ? "torch" : "spear-shield",
        shield: !end,
        torch: end,
      });
    }
  }
  return soldiers;
}
