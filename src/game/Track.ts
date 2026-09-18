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
    geometry.setAttribute("uv1", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const { colorMap, normalMap, roughnessMap, aoMap } = this.loadAsphaltTextures();
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x8b9290,
      map: colorMap,
      normalMap,
      normalScale: new THREE.Vector2(.62, .62),
      roughnessMap,
      aoMap,
      aoMapIntensity: .72,
      roughness: .88,
      metalness: 0,
      clearcoat: .14,
      clearcoatRoughness: .24,
      envMapIntensity: .82,
    });
    const road = new THREE.Mesh(geometry, material);
    road.receiveShadow = true;
    return road;
  }

  private loadAsphaltTextures(): {
    colorMap: THREE.Texture;
    normalMap: THREE.Texture;
    roughnessMap: THREE.Texture;
    aoMap: THREE.Texture;
  } {
    const loader = new THREE.TextureLoader();
    const root = "/assets/textures/asphalt-033/";
    const colorMap = loader.load(`${root}color.jpg`);
    const normalMap = loader.load(`${root}normal-gl.jpg`);
    const roughnessMap = loader.load(`${root}roughness.jpg`);
    const aoMap = loader.load(`${root}ambient-occlusion.jpg`);
    colorMap.colorSpace = THREE.SRGBColorSpace;
    for (const texture of [colorMap, normalMap, roughnessMap, aoMap]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      // The scan covers 2.5 m square. These repeats keep aggregate circular
      // instead of stretching it along the circuit's long UV axis.
      texture.repeat.set(9.6, 7);
      texture.anisotropy = 8;
    }
    return { colorMap, normalMap, roughnessMap, aoMap };
  }

  private addWetPatches(): void {
    const materials = [
      new THREE.MeshPhysicalMaterial({ color: 0x071b21, roughness: .055, metalness: .14, clearcoat: 1, clearcoatRoughness: .02, transparent: true, opacity: .78, depthWrite: false, envMapIntensity: 1.75 }),
      new THREE.MeshPhysicalMaterial({ color: 0x10282e, roughness: .095, metalness: .09, clearcoat: 1, clearcoatRoughness: .04, transparent: true, opacity: .68, depthWrite: false, envMapIntensity: 1.5 }),
    ];
    for (let i = 0; i < 54; i++) {
      const lane = [-7.1, -3.5, 1.8, 6.4][i % 4] + Math.sin(i * 2.17) * .7;
      const pose = this.getPose((i * .071 + .018) % 1, lane);
      const points: THREE.Vector2[] = [];
      for (let point = 0; point < 22; point++) {
        const angle = point / 22 * Math.PI * 2;
        const irregularity = 1 + Math.sin(point * 2.73 + i * 1.91) * .13 + Math.sin(point * 5.17 + i) * .055;
        points.push(new THREE.Vector2(Math.cos(angle) * irregularity, Math.sin(angle) * irregularity));
      }
      const patch = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(points)), materials[i % materials.length]);
      patch.scale.set(1.45 + (i % 6) * .46, .56 + (i % 4) * .2, 1);
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = -Math.atan2(pose.tangent.x, pose.tangent.z);
      patch.position.copy(pose.position).setY(.058);
      patch.renderOrder = 1;
      this.group.add(patch);
    }
  }

  private addLaneMarks(): void {
    const white = new THREE.MeshStandardMaterial({ color: 0xc9c6bc, roughness: .66, emissive: 0x090806 });
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
