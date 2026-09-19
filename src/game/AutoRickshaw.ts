import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import theme from "../theme.json";
import type { VehiclePose } from "./VehicleDynamics";

export class AutoRickshaw {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly frontWheelPivot = new THREE.Group();
  private readonly wheels: THREE.Object3D[] = [];
  private readonly heroWheels: THREE.Object3D[] = [];
  private readonly driverRig = new THREE.Group();
  private readonly headlight: THREE.SpotLight;
  private elapsed = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = "Racing Auto";
    this.group.add(this.body);
    this.buildBody();
    this.buildWheels();
    this.buildDriver();
    this.addContactShadow();
    this.loadHeroModel();

    this.headlight = new THREE.SpotLight(0xffd49a, 46, 34, Math.PI / 7, .6, 1.4);
    this.headlight.position.set(0, .78, 1.16);
    const target = new THREE.Object3D();
    target.position.set(0, .25, 9);
    this.body.add(target, this.headlight);
    this.headlight.target = target;
    this.headlight.castShadow = false;

    const tailGlow = new THREE.PointLight(0xff2b18, .65, 2.2, 2);
    tailGlow.position.set(0, .62, -.98);
    this.body.add(tailGlow);
    const tailMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3a24,
      emissive: 0xff1608,
      emissiveIntensity: 3.2,
      roughness: .28,
    });
    for (const x of [-.43, .43]) {
      const lamp = new THREE.Mesh(new RoundedBoxGeometry(.16, .24, .035, 3, .025), tailMaterial);
      lamp.position.set(x, .68, -1.08);
      lamp.rotation.y = Math.PI;
      this.driverRig.add(lamp);
    }
    scene.add(this.group);
  }

  update(delta: number, speed: number, steer: number, drift: number, physics: VehiclePose): void {
    this.elapsed += delta;
    const wheelSpin = speed * delta * .58;
    this.wheels.forEach((wheel) => { wheel.rotation.x -= wheelSpin; });
    this.heroWheels.forEach((wheel) => { wheel.rotation.x -= wheelSpin; });
    this.frontWheelPivot.rotation.y = steer * .42;
    const engineVibration = Math.sin(this.elapsed * (15 + speed * .035)) * Math.min(speed / 24000, .0018);
    this.body.position.y = THREE.MathUtils.damp(this.body.position.y, physics.heave + engineVibration, 14, delta);
    this.body.rotation.z = THREE.MathUtils.damp(this.body.rotation.z, physics.roll, 9, delta);
    this.body.rotation.x = THREE.MathUtils.damp(this.body.rotation.x, physics.pitch, 8, delta);
    this.driverRig.rotation.z = THREE.MathUtils.damp(this.driverRig.rotation.z, -physics.roll * .72 - steer * .035, 8, delta);
    this.driverRig.rotation.x = THREE.MathUtils.damp(this.driverRig.rotation.x, -physics.pitch * .45, 7, delta);
    this.wheels[0].position.y = .38 - physics.suspension[0] * .18;
    this.wheels[1].position.y = .38 - physics.suspension[1] * .18;
    this.frontWheelPivot.position.y = .37 - physics.suspension[2] * .18;
    this.headlight.intensity = 42 + Math.sin(this.elapsed * 13) * .8;
  }

  private buildBody(): void {
    const green = new THREE.MeshPhysicalMaterial({ color: 0x075c43, roughness: .24, metalness: .08, clearcoat: 1, clearcoatRoughness: .09 });
    const yellow = new THREE.MeshPhysicalMaterial({ color: 0xf2b53e, roughness: .26, metalness: .04, clearcoat: .95, clearcoatRoughness: .1 });
    const black = new THREE.MeshStandardMaterial({ color: 0x11181a, roughness: .42, metalness: .15 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xdce4e2, roughness: .15, metalness: .92, envMapIntensity: 1.65 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x84b9c2, roughness: .08, transmission: .2, transparent: true, opacity: .52, metalness: .05 });

    const chassis = new THREE.Mesh(new RoundedBoxGeometry(1.42, .48, 2.18, 5, .15), green);
    chassis.position.y = .58;
    this.body.add(chassis);

    const nose = new THREE.Mesh(new RoundedBoxGeometry(1.05, .62, .72, 4, .15), yellow);
    nose.position.set(0, .69, .96);
    this.body.add(nose);

    const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.34, 1.28, 1.42, 4, .12), black);
    cabin.position.set(0, 1.24, -.2);
    this.body.add(cabin);

    const windscreen = new THREE.Mesh(new THREE.PlaneGeometry(1.03, .72), glass);
    windscreen.position.set(0, 1.47, .525);
    windscreen.rotation.x = -.12;
    this.body.add(windscreen);

    const canopy = new THREE.Mesh(new RoundedBoxGeometry(1.56, .2, 1.7, 5, .09), yellow);
    canopy.position.set(0, 1.96, -.16);
    this.body.add(canopy);

    const bumper = new THREE.Mesh(new THREE.CapsuleGeometry(.08, 1.15, 4, 10), chrome);
    bumper.rotation.z = Math.PI / 2;
    bumper.position.set(0, .45, 1.32);
    this.body.add(bumper);

    const headlamp = new THREE.Mesh(
      new THREE.CylinderGeometry(.19, .19, .08, 24),
      new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffcb74, emissiveIntensity: 4.5, roughness: .18 }),
    );
    headlamp.rotation.x = Math.PI / 2;
    headlamp.position.set(0, .86, 1.36);
    this.body.add(headlamp);

    const plate = this.makePlate("MH 01\nAUTO");
    plate.position.set(0, .55, -1.12);
    plate.rotation.y = Math.PI;
    this.body.add(plate);

    this.body.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }

  private buildDriver(): void {
    this.driverRig.name = "Animated Mumbai auto driver";
    const shirt = new THREE.MeshStandardMaterial({ color: 0x315b72, roughness: .82 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x85543c, roughness: .88 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x181310, roughness: .9 });
    const controls = new THREE.MeshStandardMaterial({ color: 0x171c1d, roughness: .48, metalness: .42 });
    const torso = new THREE.Mesh(new RoundedBoxGeometry(.48, .58, .3, 3, .09), shirt);
    torso.position.set(0, 1.23, -.03);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.09, .105, .14, 12), skin);
    neck.position.set(0, 1.57, .01);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.205, 18, 14), skin);
    head.scale.set(.88, 1.08, .92);
    head.position.set(0, 1.75, .015);
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.208, 18, 8, 0, Math.PI * 2, 0, Math.PI * .48), hair);
    hairCap.position.set(0, 1.79, .005);
    this.driverRig.add(torso, neck, head, hairCap);
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .56, 10), controls);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 1.12, .54);
    this.driverRig.add(handlebar);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.065, .47, 5, 10), shirt);
      arm.position.set(side * .21, 1.31, .27);
      arm.rotation.set(-.72, 0, side * -.2);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(.075, 12, 10), skin);
      hand.position.set(side * .23, 1.12, .52);
      this.driverRig.add(arm, hand);
    }
    this.driverRig.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = true;
    });
    this.body.add(this.driverRig);
  }

  private buildWheels(): void {
    const tyre = new THREE.MeshStandardMaterial({ color: 0x090c0d, roughness: .74 });
    const rim = new THREE.MeshStandardMaterial({ color: 0xc9d0ce, roughness: .2, metalness: .82 });
    const makeWheel = () => {
      const wheel = new THREE.Group();
      const tyreMesh = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .22, 24), tyre);
      tyreMesh.rotation.z = Math.PI / 2;
      const rimMesh = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .235, 18), rim);
      rimMesh.rotation.z = Math.PI / 2;
      wheel.add(tyreMesh, rimMesh);
      tyreMesh.castShadow = rimMesh.castShadow = true;
      this.wheels.push(wheel);
      return wheel;
    };

    const rearLeft = makeWheel();
    rearLeft.position.set(-.73, .38, -.64);
    const rearRight = makeWheel();
    rearRight.position.set(.73, .38, -.64);
    this.frontWheelPivot.position.set(0, .37, .95);
    this.frontWheelPivot.add(makeWheel());
    this.body.add(rearLeft, rearRight, this.frontWheelPivot);
  }

  private addContactShadow(): void {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(128, 128, 22, 128, 128, 126);
    gradient.addColorStop(0, "rgba(0,0,0,.72)");
    gradient.addColorStop(.5, "rgba(0,0,0,.38)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.72, 2.62),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: .7, depthWrite: false, toneMapped: false }),
    );
    shadow.name = "Auto contact shadow";
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -.035, -.05);
    shadow.renderOrder = 2;
    this.group.add(shadow);
  }

  private loadHeroModel(): void {
    const loader = new GLTFLoader();
    const attach = (gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>, rootNode: string, headingOffset: number) => {
        // Meshy exports do not always preserve node names. Use the complete
        // imported scene when the configured root is absent.
        const source = gltf.scene.getObjectByName(rootNode) ?? gltf.scene;
        const model = source.clone(true);
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const scale = theme.vehicle.height / Math.max(size.y, .001);
        model.scale.setScalar(scale);
        model.position.set(
          -center.x * scale,
          -bounds.min.y * scale + theme.vehicle.groundOffset,
          -center.z * scale,
        );
        model.rotation.y = headingOffset;
        model.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => {
              if (material instanceof THREE.MeshStandardMaterial) {
                material.envMapIntensity = .72;
                material.metalness = Math.min(material.metalness, .48);
                material.roughness = Math.max(material.roughness, .42);
              }
            });
            if (/^Tyre_/.test(object.name)) this.heroWheels.push(object);
          }
        });
        this.body.traverse((object) => {
          if (object instanceof THREE.Mesh) object.visible = false;
        });
        this.driverRig.traverse((object) => { object.visible = true; });
        this.wheels.forEach((wheel) => wheel.traverse((object) => { object.visible = true; }));
        this.body.add(model);
    };

    loader.loadAsync(theme.vehicle.model)
      .then((gltf) => attach(gltf, theme.vehicle.rootNode, theme.vehicle.headingOffset))
      .catch(() => loader.loadAsync(theme.vehicle.fallbackModel)
        .then((gltf) => attach(gltf, theme.vehicle.fallbackRootNode, theme.vehicle.fallbackHeadingOffset))
        .catch(() => {
          // Keep the lightweight procedural auto as the final offline fallback.
        }));
  }

  private makePlate(label: string): THREE.Mesh {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#f3eee0";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#151719";
    context.lineWidth = 8;
    context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    context.fillStyle = "#111416";
    context.font = "bold 43px Arial";
    context.textAlign = "center";
    label.split("\n").forEach((line, index) => context.fillText(line, 128, 48 + index * 45));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(.62, .31), new THREE.MeshStandardMaterial({ map: texture, roughness: .48 }));
  }
}
