import * as THREE from "three";
import { Track } from "./Track";

export class Environment {
  readonly rain: THREE.Points;
  private readonly rainPositions: Float32Array;
  private readonly rainCount: number;
  private readonly water: THREE.Mesh;
  private readonly traffic: Array<{ vehicle: THREE.Group; progress: number; offset: number; speed: number }> = [];
  private readonly track: Track;
  private elapsed = 0;

  constructor(scene: THREE.Scene, track: Track, compact: boolean) {
    this.track = track;
    this.addSky(scene);
    this.addWater(scene);
    this.water = scene.getObjectByName("Arabian Sea") as THREE.Mesh;
    this.addCity(scene, track, compact ? 75 : 145);
    this.addStreetLights(scene, track, compact ? 36 : 64);
    this.addPalms(scene, track, compact ? 16 : 30);
    this.addHeroSign(scene, track);
    this.addTraffic(scene, compact ? 7 : 12);
    this.rainCount = compact ? 900 : 1900;
    const rain = this.createRain(this.rainCount);
    this.rain = rain.points;
    this.rainPositions = rain.positions;
    scene.add(this.rain);
  }

  update(delta: number, focus: THREE.Vector3): void {
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
    for (const item of this.traffic) {
      item.progress = (item.progress + delta * item.speed) % 1;
      const pose = this.track.getPose(item.progress, item.offset);
      item.vehicle.position.copy(pose.position).setY(.17);
      item.vehicle.rotation.y = Math.atan2(pose.tangent.x, pose.tangent.z);
    }
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
          topColor: { value: new THREE.Color(0x071827) },
          horizonColor: { value: new THREE.Color(0x315366) },
          warmColor: { value: new THREE.Color(0xd87a3e) },
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
      new THREE.MeshPhysicalMaterial({ color: 0x0b3545, roughness: .22, metalness: .28, clearcoat: 1, clearcoatRoughness: .11, envMapIntensity: 1.4 }),
    );
    water.name = "Arabian Sea";
    water.rotation.x = -Math.PI / 2;
    water.position.y = -1.1;
    water.receiveShadow = true;
    scene.add(water);
  }

  private addCity(scene: THREE.Scene, track: Track, count: number): void {
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

  private addStreetLights(scene: THREE.Scene, track: Track, count: number): void {
    const poleGeo = new THREE.CylinderGeometry(.09, .13, 4.8, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x273237, metalness: .62, roughness: .4 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, count * 2);
    const lampGeo = new THREE.SphereGeometry(.16, 10, 8);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffd29a, emissive: 0xff9a3c, emissiveIntensity: 5, roughness: .15 });
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
          const light = new THREE.PointLight(0xffa85d, 20, 18, 2);
          light.position.set(pose.position.x, 4.4, pose.position.z);
          scene.add(light);
        }
        index++;
      }
    }
    poles.castShadow = true;
    scene.add(poles, lamps);
  }

  private addPalms(scene: THREE.Scene, track: Track, count: number): void {
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
    const material = new THREE.PointsMaterial({ color: 0xb9d8e1, size: .035, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending });
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
