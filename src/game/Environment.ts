import * as THREE from "three";
import { Track } from "./Track";

export class Environment {
  readonly rain: THREE.Points;
  private readonly rainPositions: Float32Array;
  private readonly rainCount: number;
  private readonly water: THREE.Mesh;
  private elapsed = 0;

  constructor(scene: THREE.Scene, track: Track, compact: boolean) {
    this.addSky(scene);
    this.addWater(scene);
    this.water = scene.getObjectByName("Arabian Sea") as THREE.Mesh;
    this.addCity(scene, track, compact ? 75 : 145);
    this.addStreetLights(scene, track, compact ? 36 : 64);
    this.addPalms(scene, track, compact ? 16 : 30);
    this.addHeroSign(scene, track);
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
    const textures = this.createWindowTextures();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xaeb4ae,
      map: textures.facade,
      emissiveMap: textures.windows,
      emissive: 0xffb76e,
      emissiveIntensity: .95,
      roughness: .72,
      vertexColors: true,
    });
    const buildings = new THREE.InstancedMesh(geometry, material, count);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const colors = [0x9ca5a2, 0xb7a996, 0x87969c, 0xb49a8a, 0x8e939a];
    for (let i = 0; i < count; i++) {
      const t = (i / count + Math.sin(i * 19.13) * .006 + 1) % 1;
      const side = i % 5 === 0 ? 1 : -1;
      const distance = track.width + 10 + ((i * 17) % 15);
      const pose = track.getPose(t, side * distance);
      const width = 5.5 + (i * 7 % 9);
      const depth = 5.5 + (i * 11 % 12);
      const height = 8 + (i * 13 % 26);
      scale.set(width, height, depth);
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(pose.tangent.x, pose.tangent.z) + (side > 0 ? 0 : Math.PI));
      matrix.compose(new THREE.Vector3(pose.position.x, height / 2 - .6, pose.position.z), quaternion, scale);
      buildings.setMatrixAt(i, matrix);
      buildings.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    }
    buildings.castShadow = true;
    buildings.receiveShadow = true;
    scene.add(buildings);

    const skylineMat = new THREE.MeshStandardMaterial({ color: 0x102027, roughness: .88, emissive: 0x111c20, emissiveIntensity: .35 });
    for (let i = 0; i < 28; i++) {
      const h = 22 + (i * 29 % 58);
      const tower = new THREE.Mesh(new THREE.BoxGeometry(8 + i % 5, h, 8 + (i * 3) % 7), skylineMat);
      const angle = (i / 28) * Math.PI * 2;
      tower.position.set(Math.cos(angle) * 180, h / 2 - 1, Math.sin(angle) * 180);
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
