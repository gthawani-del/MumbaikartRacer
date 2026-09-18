import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Track } from "./Track";
import theme from "../theme.json";

export class Environment {
  readonly rain: THREE.Points;
  private readonly rainPositions: Float32Array;
  private readonly rainCount: number;
  private readonly water: THREE.Mesh;
  private readonly spray: THREE.Points;
  private readonly sprayPositions: Float32Array;
  private readonly sprayVelocity: Float32Array;
  private readonly sprayLife: Float32Array;
  private sprayCursor = 0;
  private sprayBudget = 0;
  private readonly traffic: Array<{ vehicle: THREE.Group; progress: number; offset: number; speed: number }> = [];
  private readonly track: Track;
  private readonly fallbackScenery = new THREE.Group();
  private elapsed = 0;

  constructor(scene: THREE.Scene, track: Track, compact: boolean) {
    this.track = track;
    this.addSky(scene);
    this.addWater(scene);
    this.water = scene.getObjectByName("Arabian Sea") as THREE.Mesh;
    this.fallbackScenery.name = "Procedural scenery fallback";
    scene.add(this.fallbackScenery);
    this.addCity(this.fallbackScenery, track, compact ? 75 : 145);
    this.loadEnvironmentKit(scene, track, compact);
    this.loadBookstore(scene, track);
    this.loadStreetlights(scene, track, compact ? 14 : 24);
    this.loadPalms(scene, track, compact ? 6 : 10);
    this.addHeroSign(scene, track);
    this.addTraffic(scene, compact ? 7 : 12);
    this.rainCount = compact ? theme.weather.rainMobile : theme.weather.rainDesktop;
    const rain = this.createRain(this.rainCount);
    this.rain = rain.points;
    this.rainPositions = rain.positions;
    scene.add(this.rain);
    const spray = this.createSpray(theme.weather.sprayParticles);
    this.spray = spray.points;
    this.sprayPositions = spray.positions;
    this.sprayVelocity = spray.velocity;
    this.sprayLife = spray.life;
    scene.add(this.spray);
  }

  private loadEnvironmentKit(scene: THREE.Scene, track: Track, compact: boolean): void {
    new GLTFLoader().load(theme.environment.model, (gltf) => {
      const authored = new THREE.Group();
      authored.name = "Authored Mumbai environment";
      const cloneModule = (name: string, scale = 1) => {
        const source = gltf.scene.getObjectByName(name);
        if (!source) return null;
        const module = source.clone(true);
        module.scale.setScalar(scale);
        module.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(module);
        const center = bounds.getCenter(new THREE.Vector3());
        module.position.x -= center.x;
        module.position.y -= bounds.min.y;
        module.position.z -= center.z;
        module.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        return module;
      };

      const buildingCount = compact ? 14 : 24;
      for (let i = 0; i < buildingCount; i++) {
        const name = theme.environment.buildings[i % theme.environment.buildings.length];
        const building = cloneModule(name, .82 + (i % 3) * .06);
        if (!building) continue;
        const pose = track.getPose((i / buildingCount + .01) % 1, -(track.width + 9.2 + i % 3));
        building.position.copy(pose.position);
        building.rotation.y = Math.atan2(pose.side.x, pose.side.z);
        authored.add(building);
      }

      const promenadeCount = compact ? 16 : 26;
      for (let i = 0; i < promenadeCount; i++) {
        const module = cloneModule(theme.environment.promenade, .56);
        if (!module) continue;
        const pose = track.getPose(i / promenadeCount, track.width + 3.35);
        module.position.copy(pose.position);
        module.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), pose.tangent);
        authored.add(module);
      }

      for (const progress of [.14, .47, .78]) {
        const stop = cloneModule(theme.environment.busStop, .86);
        if (!stop) continue;
        const pose = track.getPose(progress, -(track.width + 3.1));
        stop.position.copy(pose.position);
        stop.rotation.y = Math.atan2(pose.side.x, pose.side.z);
        authored.add(stop);
      }

      if (authored.children.length > 0) {
        scene.add(authored);
        this.fallbackScenery.visible = false;
      }
    });
  }

  private loadBookstore(scene: THREE.Scene, track: Track): void {
    new GLTFLoader().load(theme.environment.bookstoreModel, (gltf) => {
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = theme.environment.bookstoreHeight / Math.max(size.y, .001);
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = true;
        object.receiveShadow = true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.metalness = Math.min(material.metalness, .04);
            material.roughness = Math.max(material.roughness, .5);
            material.envMapIntensity = .72;
          }
        });
      });

      const landmark = new THREE.Group();
      landmark.name = "Bombay Books Art Deco facade";
      landmark.add(model);
      const pose = track.getPose(theme.environment.bookstoreProgress, theme.environment.bookstoreOffset);
      landmark.position.copy(pose.position).setY(.04);
      landmark.rotation.y = Math.atan2(pose.side.x, pose.side.z);
      scene.add(landmark);
    });
  }

  private loadStreetlights(scene: THREE.Scene, track: Track, count: number): void {
    new GLTFLoader().load(theme.environment.streetlightModel, (gltf) => {
      const source = this.firstMesh(gltf.scene);
      if (!source) return;
      const bounds = new THREE.Box3().setFromObject(source);
      const size = bounds.getSize(new THREE.Vector3());
      const scale = theme.environment.streetlightHeight / Math.max(size.y, .001);
      const material = new THREE.MeshStandardMaterial({
        color: 0x222a2d,
        metalness: .72,
        roughness: .32,
      });
      const instances = new THREE.InstancedMesh(source.geometry, material, count * 2);
      instances.name = "Marine Drive streetlights";
      instances.castShadow = true;
      instances.receiveShadow = true;
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const sizeVector = new THREE.Vector3(scale, scale, scale);
      let index = 0;
      for (let i = 0; i < count; i++) {
        for (const side of [-1, 1]) {
          const pose = track.getPose((i / count + .012) % 1, side * (track.width + 2.2));
          position.copy(pose.position).setY(-bounds.min.y * scale + .03);
          quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-side * pose.side.x, -side * pose.side.z));
          matrix.compose(position, quaternion, sizeVector);
          instances.setMatrixAt(index++, matrix);
          if (i % 10 === 0 && side === 1) {
            const glow = new THREE.PointLight(0xffb46b, 7, 15, 2);
            glow.position.copy(pose.position).setY(theme.environment.streetlightHeight - .3);
            scene.add(glow);
          }
        }
      }
      instances.instanceMatrix.needsUpdate = true;
      scene.add(instances);
    });
  }

  private loadPalms(scene: THREE.Scene, track: Track, count: number): void {
    new GLTFLoader().load(theme.environment.palmModel, (gltf) => {
      const source = this.firstMesh(gltf.scene);
      if (!source) return;
      const bounds = new THREE.Box3().setFromObject(source);
      const size = bounds.getSize(new THREE.Vector3());
      const scale = theme.environment.palmHeight / Math.max(size.y, .001);
      const sourceMaterial = Array.isArray(source.material) ? source.material[0] : source.material;
      const map = sourceMaterial instanceof THREE.MeshStandardMaterial ? sourceMaterial.map : null;
      if (map) map.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshLambertMaterial({
        map,
        color: 0xa9b99a,
        side: THREE.DoubleSide,
      });
      const instances = new THREE.InstancedMesh(source.geometry, material, count);
      instances.name = "Marine Drive palms";
      instances.castShadow = true;
      instances.receiveShadow = true;
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      for (let i = 0; i < count; i++) {
        const pose = track.getPose((i / count + .035) % 1, track.width + 5.7 + (i % 3) * .7);
        position.copy(pose.position).setY(-bounds.min.y * scale + .02);
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 2.399963) % (Math.PI * 2));
        const variation = scale * (.9 + (i % 5) * .04);
        matrix.compose(position, quaternion, new THREE.Vector3(variation, variation, variation));
        instances.setMatrixAt(i, matrix);
      }
      instances.instanceMatrix.needsUpdate = true;
      scene.add(instances);
    });
  }

  private firstMesh(root: THREE.Object3D): THREE.Mesh | null {
    let result: THREE.Mesh | null = null;
    root.traverse((object) => {
      if (!result && object instanceof THREE.Mesh) result = object;
    });
    return result;
  }

  update(delta: number, focus: THREE.Vector3, speed: number, tangent: THREE.Vector3, side: THREE.Vector3): void {
    this.elapsed += delta;
    const positions = this.rainPositions;
    for (let i = 0; i < this.rainCount; i++) {
      const yIndex = i * 3 + 1;
      positions[yIndex] -= delta * (25 + (i % 9));
      if (positions[yIndex] < -1) positions[yIndex] = 16 + (i % 13);
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
    this.rain.position.set(focus.x, 0, focus.z);
    this.water.position.y = -1.1 + Math.sin(this.elapsed * .5) * .045;
    this.updateSpray(delta, focus, speed, tangent, side);
    for (const item of this.traffic) {
      item.progress = (item.progress + delta * item.speed) % 1;
      const pose = this.track.getPose(item.progress, item.offset);
      item.vehicle.position.copy(pose.position).setY(.17);
      item.vehicle.rotation.y = Math.atan2(pose.tangent.x, pose.tangent.z);
    }
  }

  private updateSpray(delta: number, focus: THREE.Vector3, speed: number, tangent: THREE.Vector3, side: THREE.Vector3): void {
    for (let i = 0; i < this.sprayLife.length; i++) {
      if (this.sprayLife[i] <= 0) continue;
      this.sprayLife[i] -= delta;
      const offset = i * 3;
      this.sprayPositions[offset] += this.sprayVelocity[offset] * delta;
      this.sprayPositions[offset + 1] += this.sprayVelocity[offset + 1] * delta;
      this.sprayPositions[offset + 2] += this.sprayVelocity[offset + 2] * delta;
      this.sprayVelocity[offset + 1] -= 9.8 * delta;
      if (this.sprayLife[i] <= 0 || this.sprayPositions[offset + 1] < .04) {
        this.sprayLife[i] = 0;
        this.sprayPositions[offset + 1] = -1000;
      }
    }

    if (speed >= theme.weather.sprayMinimumSpeed) {
      this.sprayBudget += delta * Math.min(95, speed * .56);
      while (this.sprayBudget >= 1) {
        this.emitSpray(focus, speed, tangent, side, this.sprayCursor % 2 === 0 ? -1 : 1);
        this.sprayBudget -= 1;
      }
    }
    this.spray.geometry.attributes.position.needsUpdate = true;
  }

  private emitSpray(focus: THREE.Vector3, speed: number, tangent: THREE.Vector3, side: THREE.Vector3, wheelSide: number): void {
    const index = this.sprayCursor++ % this.sprayLife.length;
    const offset = index * 3;
    const origin = focus.clone().addScaledVector(tangent, -1.05).addScaledVector(side, wheelSide * .68);
    this.sprayPositions[offset] = origin.x + (Math.random() - .5) * .16;
    this.sprayPositions[offset + 1] = .22 + Math.random() * .12;
    this.sprayPositions[offset + 2] = origin.z + (Math.random() - .5) * .16;
    const backward = 1.2 + speed / 42 + Math.random() * 1.4;
    const outward = wheelSide * (.5 + Math.random() * 1.1);
    this.sprayVelocity[offset] = -tangent.x * backward + side.x * outward;
    this.sprayVelocity[offset + 1] = 1.2 + Math.random() * 2.25;
    this.sprayVelocity[offset + 2] = -tangent.z * backward + side.z * outward;
    this.sprayLife[index] = .32 + Math.random() * .32;
  }

  private createSpray(count: number): { points: THREE.Points; positions: Float32Array; velocity: Float32Array; life: Float32Array } {
    const positions = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    const life = new Float32Array(count);
    positions.fill(-1000);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xb9d6db,
      size: .075,
      sizeAttenuation: true,
      transparent: true,
      opacity: .58,
      depthWrite: false,
    });
    return { points: new THREE.Points(geometry, material), positions, velocity, life };
  }

  private addTraffic(scene: THREE.Scene, count: number): void {
    const taxiBlack = new THREE.MeshPhysicalMaterial({ color: 0x111719, roughness: .32, clearcoat: .7 });
    const taxiYellow = new THREE.MeshPhysicalMaterial({ color: 0xe3a62b, roughness: .3, clearcoat: .8 });
    const busRed = new THREE.MeshPhysicalMaterial({ color: 0xa6221b, roughness: .38, clearcoat: .55 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x173640, roughness: .24, metalness: .28 });
    const tyre = new THREE.MeshStandardMaterial({ color: 0x090b0c, roughness: .8 });
    const lamp = new THREE.MeshStandardMaterial({ color: 0xffe1a6, emissive: 0xffa54c, emissiveIntensity: 4 });

    for (let i = 0; i < count; i++) {
      const vehicle = new THREE.Group();
      const isBus = i % 5 === 0;
      const lower = new THREE.Mesh(new THREE.BoxGeometry(isBus ? 2.15 : 1.55, isBus ? 1.15 : .48, isBus ? 5.8 : 3.2), isBus ? busRed : taxiBlack);
      lower.position.y = isBus ? .95 : .55;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(isBus ? 2.02 : 1.4, isBus ? 1.7 : .74, isBus ? 4.7 : 1.72), isBus ? busRed : taxiYellow);
      cabin.position.set(0, isBus ? 2.25 : 1.1, isBus ? -.22 : -.18);
      const windscreen = new THREE.Mesh(new THREE.PlaneGeometry(isBus ? 1.72 : 1.14, isBus ? .82 : .5), glass);
      windscreen.position.set(0, isBus ? 2.46 : 1.22, isBus ? 2.16 : .7);
      vehicle.add(lower, cabin, windscreen);
      for (const x of [-.55, .55]) {
        const headlamp = new THREE.Mesh(new THREE.CircleGeometry(.1, 12), lamp);
        headlamp.position.set(x * (isBus ? 1.42 : 1), isBus ? .85 : .64, isBus ? 2.92 : 1.62);
        vehicle.add(headlamp);
      }
      for (const x of [-1, 1]) {
        for (const z of [-1, 1]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(isBus ? .42 : .31, isBus ? .42 : .31, .2, 18), tyre);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x * (isBus ? 1.03 : .78), isBus ? .5 : .35, z * (isBus ? 2.05 : 1.05));
          vehicle.add(wheel);
        }
      }
      vehicle.scale.setScalar(.78);
      vehicle.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
      scene.add(vehicle);
      this.traffic.push({
        vehicle,
        progress: (i / count + .08) % 1,
        offset: [-7.2, -3.8, 3.8, 7.2][i % 4],
        speed: .011 + (i % 3) * .002,
      });
    }
  }

  private addSky(scene: THREE.Scene): void {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(520, 32, 18),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          topColor: { value: new THREE.Color(theme.palette.skyTop) },
          horizonColor: { value: new THREE.Color(theme.palette.skyHorizon) },
          warmColor: { value: new THREE.Color(theme.palette.skyWarm) },
        },
        vertexShader: `varying vec3 vWorld; void main(){ vec4 world = modelMatrix * vec4(position,1.0); vWorld=world.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `
          uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 warmColor; varying vec3 vWorld;
          void main(){
            vec3 dir=normalize(vWorld); float h=clamp(dir.y*.9+.18,0.0,1.0);
            vec3 sky=mix(horizonColor,topColor,smoothstep(.02,.72,h));
            float glow=pow(max(dot(dir,normalize(vec3(-.72,.13,-.38))),0.0),26.0);
            gl_FragColor=vec4(mix(sky,warmColor,glow*.72),1.0);
          }`,
      }),
    );
    scene.add(sky);
  }

  private addWater(scene: THREE.Scene): void {
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(350, 96),
      new THREE.MeshPhysicalMaterial({ color: theme.palette.sea, roughness: .3, metalness: .18, clearcoat: .72, clearcoatRoughness: .18, envMapIntensity: 1 }),
    );
    water.name = "Arabian Sea";
    water.rotation.x = -Math.PI / 2;
    water.position.y = -1.1;
    water.receiveShadow = true;
    scene.add(water);
  }

  private addCity(scene: THREE.Object3D, track: Track, count: number): void {
    const palette = [0xc3b69d, 0xa7b3af, 0xd0b9a3, 0x9faeb2, 0xbca59a];
    const glass = new THREE.MeshStandardMaterial({ color: 0x233c43, emissive: 0xffa85b, emissiveIntensity: 1.35, roughness: .3, metalness: .1 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xe5ddcc, roughness: .68 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1f292b, roughness: .8 });
    const facadeCount = Math.min(count, 62);

    for (let i = 0; i < facadeCount; i++) {
      const t = (i / facadeCount + .006 * Math.sin(i * 8.1) + 1) % 1;
      const pose = track.getPose(t, -(track.width + 8.5 + i % 4));
      const building = new THREE.Group();
      const width = 8.5 + i % 5 * 1.1;
      const height = 7.5 + i % 6 * 1.4;
      const depth = 5.8 + i % 3;
      const facade = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ color: palette[i % palette.length], roughness: .76, metalness: .02 }),
      );
      facade.position.y = height / 2;
      building.add(facade);

      const floors = Math.floor(height / 1.5);
      for (let floor = 1; floor < floors; floor++) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(width + .18, .11, .3), trim);
        band.position.set(0, floor * 1.48, depth / 2 + .12);
        building.add(band);
        for (let bay = -2; bay <= 2; bay++) {
          if ((bay + floor + i) % 4 === 0) continue;
          const window = new THREE.Mesh(new THREE.PlaneGeometry(.72, .66), glass);
          window.position.set(bay * width / 6, floor * 1.48 + .55, depth / 2 + .16);
          building.add(window);
        }
      }

      if (i % 3 === 0) {
        const roundedCorner = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, height + .3, 18, 1, false, 0, Math.PI), facade.material);
        roundedCorner.rotation.y = Math.PI / 2;
        roundedCorner.position.set(width / 2, height / 2, depth / 2 - .1);
        building.add(roundedCorner);
      }

      const awning = new THREE.Mesh(new THREE.BoxGeometry(width * .72, .18, 1.2), i % 2 ? dark : trim);
      awning.position.set(0, 1.25, depth / 2 + .52);
      awning.rotation.x = -.12;
      building.add(awning);
      building.position.copy(pose.position);
      building.rotation.y = Math.atan2(pose.tangent.x, pose.tangent.z);
      building.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      scene.add(building);
    }

    const skylineMat = new THREE.MeshStandardMaterial({ color: 0x15272d, roughness: .92, emissive: 0x0d171a, emissiveIntensity: .24 });
    for (let i = 0; i < 18; i++) {
      const h = 18 + (i * 17 % 32);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(5 + i % 3, 6 + i % 4, h, i % 2 ? 8 : 12), skylineMat);
      const angle = i / 18 * Math.PI * 2;
      tower.position.set(Math.cos(angle) * 205, h / 2 - 2, Math.sin(angle) * 205);
      scene.add(tower);
    }
  }

  private addStreetLights(scene: THREE.Object3D, track: Track, count: number): void {
    const poleGeo = new THREE.CylinderGeometry(.09, .13, 4.8, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x273237, metalness: .62, roughness: .4 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, count * 2);
    const lampGeo = new THREE.SphereGeometry(.16, 10, 8);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffd29a, emissive: 0xff9a3c, emissiveIntensity: 2.3, roughness: .22 });
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, count * 2);
    const matrix = new THREE.Matrix4();
    let index = 0;
    for (let i = 0; i < count; i++) {
      for (const side of [-1, 1]) {
        const pose = track.getPose(i / count, side * (track.width + 2.1));
        matrix.makeTranslation(pose.position.x, 2.4, pose.position.z);
        poles.setMatrixAt(index, matrix);
        matrix.makeTranslation(pose.position.x, 4.78, pose.position.z);
        lamps.setMatrixAt(index, matrix);
        if (i % 8 === 0 && side === 1) {
          const light = new THREE.PointLight(0xffa85d, 8, 14, 2);
          light.position.set(pose.position.x, 4.4, pose.position.z);
          scene.add(light);
        }
        index++;
      }
    }
    poles.castShadow = true;
    scene.add(poles, lamps);
  }

  private addPalms(scene: THREE.Object3D, track: Track, count: number): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x57402f, roughness: .85 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1d573e, roughness: .78, side: THREE.DoubleSide });
    for (let i = 0; i < count; i++) {
      const pose = track.getPose((i / count + .045) % 1, track.width + 5.5 + (i % 3));
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.18, .3, 5.5, 7), trunkMat);
      trunk.position.y = 2.7;
      palm.add(trunk);
      for (let leaf = 0; leaf < 7; leaf++) {
        const frond = new THREE.Mesh(new THREE.PlaneGeometry(.45, 3.5, 1, 3), leafMat);
        frond.position.y = 5.65;
        frond.rotation.set(-.45, leaf / 7 * Math.PI * 2, .15);
        frond.translateY(1.2);
        palm.add(frond);
      }
      palm.position.copy(pose.position);
      palm.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
      scene.add(palm);
    }
  }

  private addHeroSign(scene: THREE.Scene, track: Track): void {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#071319";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#f4b146";
    context.lineWidth = 12;
    context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    context.fillStyle = "#f6efe0";
    context.font = "900 86px Arial";
    context.textAlign = "center";
    context.fillText("MARINE DRIVE", 512, 112);
    context.fillStyle = "#f4b146";
    context.font = "700 57px Arial";
    context.fillText("मरीन ड्राइव · मुंबई", 512, 193);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const pose = track.getPose(.015, -track.width - 3.2);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0x4b2d12, emissiveIntensity: .8 }));
    sign.position.copy(pose.position).setY(3.6);
    sign.rotation.y = Math.atan2(pose.tangent.x, pose.tangent.z) + Math.PI / 2;
    scene.add(sign);
  }

  private createRain(count: number): { points: THREE.Points; positions: Float32Array } {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - .5) * 52;
      positions[i * 3 + 1] = Math.random() * 28;
      positions[i * 3 + 2] = (Math.random() - .5) * 52;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0x91b3bc, size: .022, transparent: true, opacity: theme.weather.rainOpacity, depthWrite: false });
    return { points: new THREE.Points(geometry, material), positions };
  }

  private createWindowTextures(): { facade: THREE.CanvasTexture; windows: THREE.CanvasTexture } {
    const makeCanvas = (emissive: boolean) => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 512;
      const context = canvas.getContext("2d")!;
      context.fillStyle = emissive ? "#000" : "#858c8b";
      context.fillRect(0, 0, 256, 512);
      for (let y = 16; y < 500; y += 42) {
        for (let x = 14; x < 250; x += 42) {
          const lit = ((x * 7 + y * 11) % 5) > 1;
          context.fillStyle = emissive ? (lit ? "#ff9f47" : "#040506") : (lit ? "#66777a" : "#475155");
          context.fillRect(x, y, 22, 24);
        }
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1.5, 3.2);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };
    return { facade: makeCanvas(false), windows: makeCanvas(true) };
  }
}
