import * as THREE from "three";
import theme from "../theme.json";

export interface TrackPose {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  side: THREE.Vector3;
}

export class Track {
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;
  readonly width = 12;
  readonly group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-58, 0, 22),
      new THREE.Vector3(-48, 0, -36),
      new THREE.Vector3(-12, 0, -78),
      new THREE.Vector3(44, 0, -88),
      new THREE.Vector3(98, 0, -62),
      new THREE.Vector3(124, 0, -12),
      new THREE.Vector3(109, 0, 40),
      new THREE.Vector3(62, 0, 72),
      new THREE.Vector3(6, 0, 76),
      new THREE.Vector3(-42, 0, 57),
    ], true, "catmullrom", 0.32);
    this.length = this.curve.getLength();
    this.group.name = "Maximum City Circuit";
    this.group.add(this.createRoad());
    this.addWetPatches();
    this.addLaneMarks();
    this.addRoadEdge();
    this.addPromenadeBarrier();
    scene.add(this.group);
  }

  getPose(progress: number, offset = 0): TrackPose {
    const t = ((progress % 1) + 1) % 1;
    const position = this.curve.getPointAt(t);
    const tangent = this.curve.getTangentAt(t).normalize();
    const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    position.addScaledVector(side, offset);
    return { position, tangent, side };
  }

  private createRoad(): THREE.Mesh {
    const segments = 360;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const pose = this.getPose(t);
      for (const direction of [-1, 1]) {
        const edge = pose.position.clone().addScaledVector(pose.side, direction * this.width);
        positions.push(edge.x, .04, edge.z);
        uvs.push(direction < 0 ? 0 : 1, t * 34);
      }
      if (i < segments) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const { colorMap, roughnessMap } = this.createAsphaltTextures();
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x6f7778,
      map: colorMap,
      roughnessMap,
      roughness: .82,
      metalness: .04,
      clearcoat: .42,
      clearcoatRoughness: .18,
      envMapIntensity: 1.05,
    });
    const road = new THREE.Mesh(geometry, material);
    road.receiveShadow = true;
    return road;
  }

  private createAsphaltTextures(): { colorMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    const size = 512;
    const colorCanvas = document.createElement("canvas");
    const roughnessCanvas = document.createElement("canvas");
    colorCanvas.width = colorCanvas.height = roughnessCanvas.width = roughnessCanvas.height = size;
    const colorContext = colorCanvas.getContext("2d")!;
    const roughnessContext = roughnessCanvas.getContext("2d")!;
    const colorImage = colorContext.createImageData(size, size);
    const roughnessImage = roughnessContext.createImageData(size, size);
    let seed = 18427;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < size * size; i++) {
      const grain = random();
      const aggregate = random() > .986 ? 26 + random() * 24 : 0;
      const value = Math.round(24 + grain * 18 + aggregate);
      const colorOffset = i * 4;
      colorImage.data[colorOffset] = value;
      colorImage.data[colorOffset + 1] = value + 3;
      colorImage.data[colorOffset + 2] = value + 4;
      colorImage.data[colorOffset + 3] = 255;
      const roughness = Math.round(154 + grain * 74 - aggregate * 1.4);
      roughnessImage.data[colorOffset] = roughness;
      roughnessImage.data[colorOffset + 1] = roughness;
      roughnessImage.data[colorOffset + 2] = roughness;
      roughnessImage.data[colorOffset + 3] = 255;
    }
    colorContext.putImageData(colorImage, 0, 0);
    roughnessContext.putImageData(roughnessImage, 0, 0);

    const colorMap = new THREE.CanvasTexture(colorCanvas);
    colorMap.colorSpace = THREE.SRGBColorSpace;
    const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
    for (const texture of [colorMap, roughnessMap]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(7, 1);
      texture.anisotropy = 8;
    }
    return { colorMap, roughnessMap };
  }

  private addWetPatches(): void {
    const materials = [
      new THREE.MeshPhysicalMaterial({ color: 0x0c2229, roughness: .06, metalness: .12, clearcoat: 1, clearcoatRoughness: .025, transparent: true, opacity: .58, depthWrite: false, envMapIntensity: 1.55 }),
      new THREE.MeshPhysicalMaterial({ color: 0x1a3035, roughness: .11, metalness: .08, clearcoat: 1, clearcoatRoughness: .045, transparent: true, opacity: .46, depthWrite: false, envMapIntensity: 1.35 }),
    ];
    for (let i = 0; i < 54; i++) {
      const lane = [-7.1, -3.5, 1.8, 6.4][i % 4] + Math.sin(i * 2.17) * .7;
      const pose = this.getPose((i * .071 + .018) % 1, lane);
      const patch = new THREE.Mesh(new THREE.CircleGeometry(1, 28), materials[i % materials.length]);
      patch.scale.set(1.45 + (i % 6) * .46, .56 + (i % 4) * .2, 1);
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = -Math.atan2(pose.tangent.x, pose.tangent.z);
      patch.position.copy(pose.position).setY(.058);
      patch.renderOrder = 1;
      this.group.add(patch);
    }
  }

  private addLaneMarks(): void {
    const white = new THREE.MeshStandardMaterial({ color: 0xe7e3d6, roughness: .4, emissive: 0x302d24 });
    for (const lane of [-4, 0, 4]) {
      for (let i = 0; i < 72; i++) {
        if (i % 2) continue;
        const pose = this.getPose(i / 72, lane);
        const mark = new THREE.Mesh(new THREE.BoxGeometry(.13, .025, 2.7), white);
        mark.position.copy(pose.position).setY(.085);
        mark.rotation.y = Math.atan2(pose.tangent.x, pose.tangent.z);
        this.group.add(mark);
      }
    }
  }

  private addRoadEdge(): void {
    const curbMaterials = [
      new THREE.MeshStandardMaterial({ color: 0xe6ded0, roughness: .72 }),
      new THREE.MeshStandardMaterial({ color: 0x2d3334, roughness: .78 }),
    ];
    for (let i = 0; i < 150; i++) {
      const t = i / 150;
      for (const side of [-1, 1]) {
        const pose = this.getPose(t, side * (this.width + .4));
        const curb = new THREE.Mesh(new THREE.BoxGeometry(.48, .22, 2.45), curbMaterials[(i + (side > 0 ? 1 : 0)) % 2]);
        curb.position.copy(pose.position).setY(.12);
        curb.rotation.y = Math.atan2(pose.tangent.x, pose.tangent.z);
        curb.receiveShadow = true;
        this.group.add(curb);
      }
    }
  }

  private addPromenadeBarrier(): void {
    const postGeo = new THREE.CylinderGeometry(.15, .2, .82, 10);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xd8d4c9, roughness: .56 });
    const posts = new THREE.InstancedMesh(postGeo, postMat, 110);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 110; i++) {
      const pose = this.getPose(i / 110, this.width + 1.25);
      matrix.makeTranslation(pose.position.x, .46, pose.position.z);
      posts.setMatrixAt(i, matrix);
    }
    posts.castShadow = true;
    posts.receiveShadow = true;
    this.group.add(posts);
  }
}
