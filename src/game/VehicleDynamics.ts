import * as THREE from "three";

export interface VehiclePose {
  heave: number;
  pitch: number;
  roll: number;
  suspension: [number, number, number];
}

/** Lightweight chase-camera dynamics. Track motion remains deterministic and
 * this only smooths visual weight transfer, avoiding a second physics world. */
export class VehicleDynamics {
  private roll = 0;
  private pitch = 0;

  update(delta: number, speed: number, steer: number, drift: number, braking: boolean): VehiclePose {
    const speedFactor = THREE.MathUtils.clamp(speed / 110, 0, 1);
    const targetRoll = -(steer * .065 + drift * .045) * speedFactor;
    const targetPitch = braking ? -.028 : speed > 105 ? .012 : 0;
    this.roll = THREE.MathUtils.damp(this.roll, targetRoll, 7.5, delta);
    this.pitch = THREE.MathUtils.damp(this.pitch, targetPitch, 8, delta);
    const load = this.roll * .55;
    return {
      heave: 0,
      pitch: this.pitch,
      roll: this.roll,
      suspension: [Math.max(0, load), Math.max(0, -load), Math.max(0, -this.pitch)],
    };
  }
}
