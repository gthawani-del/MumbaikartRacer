import * as THREE from "three";

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
    this.addLaneMarks();
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

    const material = new THREE.MeshPhysicalMaterial({
      color: 0x242c31,
      roughness: .24,
      metalness: .08,
      clearcoat: .82,
      clearcoatRoughness: .16,
      envMapIntensity: 1.25,
    });
    const road = new THREE.Mesh(geometry, material);
    road.receiveShadow = true;
    return road;
  }

  private addLaneMarks(): void {
    const white = new THREE.MeshStandardMaterial({ color: 0xd9d6c8, roughness: .35, emissive: 0x26231b });
    const amber = new THREE.MeshStandardMaterial({ color: 0xf3a53c, roughness: .3, emissive: 0x6b3105, emissiveIntensity: .5 });
    for (let i = 0; i < 92; i++) {
      const t = i / 92;
      const pose = this.getPose(t);
      const mark = new THREE.Mesh(new THREE.BoxGeometry(.18, .035, 3.1), i % 2 ? white : amber);
      mark.position.copy(pose.position).setY(.09);
      mark.rotation.y = Math.atan2(pose.tangent.x, pose.tangent.z);
      this.group.add(mark);
    }
  }

  private addPromenadeBarrier(): void {
    const postGeo = new THREE.BoxGeometry(.28, 1.05, .28);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xe2ded3, roughness: .58 });
    const posts = new THREE.InstancedMesh(postGeo, postMat, 110);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 110; i++) {
      const pose = this.getPose(i / 110, this.width + 1.25);
      matrix.makeTranslation(pose.position.x, .55, pose.position.z);
      posts.setMatrixAt(i, matrix);
    }
    posts.castShadow = true;
    posts.receiveShadow = true;
    this.group.add(posts);
  }
}
