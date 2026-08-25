// =====================================================================
//  小队导演：只发目标/阵型槽位，不遥控单兵（G6）
// =====================================================================

import { createEventBus } from "../../core/eventBus.js";

export function createSquadDirector(members, bus = createEventBus()) {
  return {
    members,
    orderQueue: [],
    issue(order) {
      this.orderQueue.push(order);
      bus.emit("squad.order", { id: order.id, type: order.type });
    },
    peek() {
      return this.orderQueue[this.orderQueue.length - 1] || { type: "hold", target: null };
    },
    assignSlots(order, _world) {
      const slots = new Map();
      const sorted = [...this.members].sort((a, b) => (a.id < b.id ? -1 : 1));
      sorted.forEach((a, i) => {
        const t = a.path.points[0] || a.position;
        slots.set(a.id, {
          x: t.x + (i % 4) * 0.7,
          y: t.y,
          z: t.z + Math.floor(i / 4) * 0.7,
        });
        a.blackboard.order = order;
        a.blackboard.slot = slots.get(a.id);
      });
      return slots;
    },
  };
}
