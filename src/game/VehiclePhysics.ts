import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

export interface VehiclePose {
  heave: number;
  pitch: number;
  roll: number;
  suspension: [number, number, number];
}

export class VehiclePhysics {
  private readonly world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  private readonly body: RAPIER.RigidBody;
  private readonly wheelAnchors = [
    new THREE.Vector3(-.66, .12, -.61),
    new THREE.Vector3(.66, .12, -.61),
    new THREE.Vector3(0, .12, .92),
  ] as const;
  private readonly suspension: [number, number, number] = [0, 0, 0];
  private accumulator = 0;

  constructor() {
    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -.08, 0));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(8, .08, 8).setFriction(1.15), ground);
    this.body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, .56, 0)
        .setAdditionalMass(275)
        .setLinearDamping(1.8)
        .setAngularDamping(5.2),
    );
    this.body.setEnabledTranslations(false, true, false, true);
    this.body.setEnabledRotations(true, false, true, true);
  }

  update(delta: number, speed: number, steer: number, drift: number, braking: boolean): VehiclePose {
    this.accumulator = Math.min(this.accumulator + delta, 1 / 15);
    while (this.accumulator >= 1 / 60) {
      this.step(speed, steer, drift, braking);
      this.world.timestep = 1 / 60;
      this.world.step();
      this.accumulator -= 1 / 60;
    }
    const rotation = this.body.rotation();
    const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w), "YXZ");
    return {
      heave: THREE.MathUtils.clamp(this.body.translation().y - .56, -.045, .075),
      pitch: THREE.MathUtils.clamp(euler.x, -.055, .055),
      roll: THREE.MathUtils.clamp(euler.z, -.11, .11),
      suspension: [...this.suspension] as [number, number, number],
    };
  }

  private step(speed: number, steer: number, drift: number, braking: boolean): void {
    const translation = this.body.translation();
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    this.wheelAnchors.forEach((anchor, index) => {
      const point = anchor.clone().applyQuaternion(quaternion).add(new THREE.Vector3(translation.x, translation.y, translation.z));
      const origin = { x: point.x, y: point.y + .28, z: point.z };
      const hit = this.world.castRay(new RAPIER.Ray(origin, { x: 0, y: -1, z: 0 }), .95, true, undefined, undefined, undefined, this.body);
      const length = hit ? Math.max(.08, hit.timeOfImpact - .31) : .54;
      const compression = THREE.MathUtils.clamp(.38 - length, 0, .28);
      this.suspension[index] = THREE.MathUtils.damp(this.suspension[index], compression, 14, 1 / 60);
      if (!hit) return;
      const velocity = this.body.velocityAtPoint(point);
      const force = Math.max(0, compression * 9200 - velocity.y * 1320);
      this.body.addForceAtPoint({ x: 0, y: force, z: 0 }, point, true);
    });
    const speedFactor = THREE.MathUtils.clamp(speed / 110, 0, 1);
    const targetRoll = -(steer * .72 + drift * .55) * speedFactor;
    const targetPitch = braking ? -.2 : speed > 90 ? .055 : 0;
    const angvel = this.body.angvel();
    this.body.addTorque({
      x: (targetPitch - angvel.x * .12) * 125,
      y: 0,
      z: (targetRoll - angvel.z * .16) * 155,
    }, true);
    if (translation.y < .25 || translation.y > .85) {
      this.body.setTranslation({ x: 0, y: .56, z: 0 }, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  }
}
