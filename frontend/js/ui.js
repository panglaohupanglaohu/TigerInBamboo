// 视角预设：每个机位都保持屏风画的"平远"构图
import * as THREE from "three";

export class CameraDirector {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.preset = "panorama";
    this._blend = 0;
    this._from = new THREE.Vector3();
    this._fromTarget = new THREE.Vector3();
    this._bindButtons();
  }

  _bindButtons() {
    document.querySelectorAll("#camera-presets .preset").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#camera-presets .preset").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.set(btn.dataset.preset);
      });
    });
  }

  set(preset) {
    this.preset = preset;
    this._blend = 0;
    this._from.copy(this.camera.position);
    this._fromTarget.copy(this.controls.target);
    this.controls.enabled = preset === "panorama";
  }

  update(dt, tiger, pheasant) {
    if (this.preset === "pheasant" && !pheasant) this.set("panorama"); // 鸟类暂不上场
    const desired = new THREE.Vector3();
    const look = new THREE.Vector3();
    switch (this.preset) {
      case "follow": {
        // 随虎：斜后上方，取画谱"回望"之势
        const back = new THREE.Vector3(0, 0, -1).applyQuaternion(tiger.group.quaternion);
        desired.copy(tiger.group.position).addScaledVector(back, 6.5).add(new THREE.Vector3(2.2, 3.0, 0));
        look.copy(tiger.group.position).add(new THREE.Vector3(0, 1.2, 0));
        break;
      }
      case "pheasant": {
        const p = pheasant.group.position;
        desired.set(p.x + 3.4, p.y + 2.0, p.z + 3.8);
        look.set(p.x, p.y + 0.3, p.z);
        break;
      }
      case "stream": {
        // 溪涧平远：低机位顺水而望
        desired.set(-2, 3.2, -20);
        look.set(2, 0.2, 8);
        break;
      }
      default: {
        // 全景：屏风正面，金地为底
        desired.set(4, 10, 30);
        look.set(0, 1.5, 0);
        break;
      }
    }
    if (this.preset === "panorama") {
      if (this._blend < 1) {
        this._blend = Math.min(this._blend + dt * 1.5, 1);
        const k = ease(this._blend);
        this.camera.position.lerpVectors(this._from, desired, k);
        this.controls.target.lerpVectors(this._fromTarget, look, k);
      }
      this.controls.update();
      return;
    }
    // 平滑趋近目标机位
    this._blend = Math.min(this._blend + dt * 1.2, 1);
    const k = ease(this._blend);
    this.camera.position.lerpVectors(this._from, desired, k);
    this._from.copy(this.camera.position);
    this.controls.target.lerp(look, Math.min(dt * 5, 1));
    this.camera.lookAt(this.controls.target);
  }
}

function ease(t) { return t * t * (3 - 2 * t); }

export function updateAgentPanel(tiger, rabbit, crane, geese = []) {
  const t = document.getElementById("tiger-state");
  const r = document.getElementById("rabbit-state");
  const c = document.getElementById("crane-state");
  const g = document.getElementById("goose-state");
  if (t) t.textContent = tiger.state;
  if (r && rabbit) r.textContent = rabbit.stateLabel;
  if (c) c.textContent = crane.stateLabel;
  if (g) g.textContent = geese.map((x) => x.stateLabel).join(" · ");
}
