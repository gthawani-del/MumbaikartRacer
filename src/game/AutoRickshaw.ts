import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class AutoRickshaw {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly frontWheelPivot = new THREE.Group();
  private readonly wheels: THREE.Object3D[] = [];
  private readonly heroWheels: THREE.Object3D[] = [];
  private readonly headlight: THREE.SpotLight;
  private elapsed = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = "Racing Auto";
    this.group.add(this.body);
    this.buildBody();
    this.buildWheels();
    this.loadHeroModel();

    this.headlight = new THREE.SpotLight(0xffd49a, 46, 34, Math.PI / 7, .6, 1.4);
    this.headlight.position.set(0, .78, 1.16);
    const target = new THREE.Object3D();
    target.position.set(0, .25, 9);
    this.body.add(target, this.headlight);
    this.headlight.target = target;
    this.headlight.castShadow = false;

    const tailGlow = new THREE.PointLight(0xff2b18, 4.5, 5.5, 2);
    tailGlow.position.set(0, .62, -.98);
    this.body.add(tailGlow);
    scene.add(this.group);
  }

  update(delta: number, speed: number, steer: number, drift: number): void {
    this.elapsed += delta;
    const wheelSpin = speed * delta * .58;
    this.wheels.forEach((wheel) => { wheel.rotation.x -= wheelSpin; });
    this.heroWheels.forEach((wheel) => { wheel.rotation.x -= wheelSpin; });
    this.frontWheelPivot.rotation.y = steer * .42;
    const engineVibration = Math.sin(this.elapsed * (18 + speed * .08)) * Math.min(speed / 800, .018);
    this.body.position.y = engineVibration + Math.sin(this.elapsed * 5) * .006;
    this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, -steer * .105 - drift * .14, 1 - Math.exp(-delta * 8));
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, -Math.min(speed / 3600, .035), 1 - Math.exp(-delta * 4));
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

    const driverTorso = new THREE.Mesh(new RoundedBoxGeometry(.48, .64, .32, 3, .1), new THREE.MeshStandardMaterial({ color: 0x632a21, roughness: .68 }));
    driverTorso.position.set(0, 1.24, -.08);
    this.body.add(driverTorso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 18, 14), new THREE.MeshStandardMaterial({ color: 0x8a5438, roughness: .72 }));
    head.position.set(0, 1.68, -.01);
    this.body.add(head);

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

  private loadHeroModel(): void {
    new GLTFLoader().load(
      "/assets/mumbai-racing-auto.glb",
      (gltf) => {
        const source = gltf.scene.getObjectByName("Racing_Auto_Root");
        if (!source) return;
        source.removeFromParent();
        const model = source.clone(true);
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const scale = 2.18 / Math.max(size.y, .001);
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        model.rotation.y = Math.PI;
        model.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => {
              if (material instanceof THREE.MeshStandardMaterial) material.envMapIntensity = 1.2;
            });
            if (/^Tyre_/.test(object.name)) this.heroWheels.push(object);
          }
        });
        this.body.traverse((object) => {
          if (object instanceof THREE.Mesh) object.visible = false;
        });
        this.body.add(model);
      },
      undefined,
      () => {
        // Keep the lightweight procedural auto as a resilient offline fallback.
      },
    );
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
