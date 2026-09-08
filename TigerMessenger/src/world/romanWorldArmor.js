import { bindRomanSoldierEquipment } from "../assets/romanSoldierEquipment.js";

// Static original-world roles outside the phalanx own their rope/torch animation.
// Attach appearance only; never override those gameplay poses.
export function bindOriginalWorldRomanArmor(scene) {
  const names = new Set(["tie-soldier", "night-torch-soldier", "night-shield-soldier"]);
  const candidates = [];
  scene.traverse(node => { if (names.has(node.name)) candidates.push(node); });
  const controllers = candidates.map(node => bindRomanSoldierEquipment(node, {armorOnly:true})).filter(Boolean);
  return {
    get count() { return controllers.length; },
    update() {
      for (let i = controllers.length - 1; i >= 0; i--) {
        const controller = controllers[i];
        let attached = false;
        for (let n = controller.actor; n; n = n.parent) if (n === scene) { attached = true; break; }
        if (!attached) { controller.dispose(); controllers.splice(i, 1); }
      }
    },
    dispose() { for (const controller of controllers) controller.dispose(); controllers.length = 0; },
  };
}
