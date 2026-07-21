// 寒梅归雁图 · 视角预设与界面：全景 / 梅下 / 塘雁 / 归飞（随雁）/ 远山
import * as THREE from "../assets/vendor/three/three.module.js";
import { PLUM_TREE_POS, POND } from "./environment-plum.js";

export class PlumCameraDirector {
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

  update(dt, flock) {
    const desired = new THREE.Vector3();
    const look = new THREE.Vector3();
    switch (this.preset) {
      case "plum": {
        // 梅下：贴地仰观，干枝蔽空
        desired.set(1, 1.6, 30);
        look.set(PLUM_TREE_POS.x, 34, PLUM_TREE_POS.z);
        break;
      }
      case "pond": {
        // 塘雁：隔水望坡，栖雁与游雁皆入画
        desired.set(8, 2.5, 6);
        look.set(POND.cx, 0.5, POND.cz);
        break;
      }
      case "flight": {
        // 归飞：随领头雁，取其掠塘之势
        const g = flock?.leader;
        if (g) {
          const p = g.pos;
          const back = new THREE.Vector3(Math.sin(g.yaw), 0, Math.cos(g.yaw)).multiplyScalar(-7);
          desired.copy(p).add(back).add(new THREE.Vector3(1.6, 2.6, 0));
          look.copy(p);
          break;
        }
        this.set("panorama");
        return;
      }
      case "mountains": {
        // 远山：隔水而望，山嶂占满、远线一抹（抬高至 7/8，仰望更甚）
        desired.set(0, 5, 18);
        look.set(0, 52, -220);
        break;
      }
      default: {
        // 全景：上移 1m（2.8m），左移 6m，主干居画幅 1/4，归雁居中为焦点
        desired.set(-6, 2.8, 42);
        look.set(4, 16, -40);
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
    this._blend = Math.min(this._blend + dt * 1.2, 1);
    const k = ease(this._blend);
    this.camera.position.lerpVectors(this._from, desired, k);
    this._from.copy(this.camera.position);
    this.controls.target.lerp(look, Math.min(dt * 5, 1));
    this.camera.lookAt(this.controls.target);
  }
}

function ease(t) { return t * t * (3 - 2 * t); }

export function updatePlumAgentPanel(flock, config) {
  const g = document.getElementById("goose-state");
  if (g && flock) g.textContent = flock.stateLabel;
  const w = document.getElementById("weather-state");
  if (w) {
    const s = config.plum?.snowfall ?? 0.35;
    w.textContent = s > 0.02 ? `薄雪 · ${Math.round(Math.min(s / 2, 1) * 100)}%` : "晴寒";
  }
}
