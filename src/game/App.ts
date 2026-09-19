import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { AutoRickshaw } from "./AutoRickshaw";
import { Environment } from "./Environment";
import { Input } from "./Input";
import { Track } from "./Track";
import { VehicleDynamics } from "./VehicleDynamics";
import theme from "../theme.json";

type Mode = "waiting" | "cinematic" | "drive";

export class App {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, .1, 900);
  private readonly clock = new THREE.Clock();
  private readonly track: Track;
  private readonly auto: AutoRickshaw;
  private readonly environment: Environment;
  private readonly input: Input;
  private readonly vehicleDynamics = new VehicleDynamics();
  private readonly mobile = matchMedia("(pointer: coarse)").matches || window.innerWidth < 760;
  private mode: Mode = "waiting";
  private modeTime = 0;
  private progress = .985;
  private laneOffset = 0;
  private lateralVelocity = 0;
  private speed = 0;
  private steer = 0;
  private drift = 0;
  private audioContext?: AudioContext;
  private engineOscillator?: OscillatorNode;
  private engineGain?: GainNode;
  private contextLost = false;

  constructor(private readonly root: HTMLElement, canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.mobile, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = theme.render.exposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1 : 1.25));
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.contextLost = true;
      document.getElementById("loading")?.classList.remove("is-hidden");
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.contextLost = false;
      this.resize();
      document.getElementById("loading")?.classList.add("is-hidden");
    });

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
    pmrem.dispose();
    this.scene.fog = new THREE.FogExp2(theme.render.fogColor, theme.render.fogDensity);

    this.track = new Track(this.scene);
    this.auto = new AutoRickshaw(this.scene);
    this.environment = new Environment(this.scene, this.track, this.mobile);
    this.input = new Input(root);
    this.addLighting();
    this.placeAuto();

    this.camera.position.set(-50, 4, 31);
    this.camera.lookAt(this.auto.group.position);
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.bindUi();
    requestAnimationFrame(() => this.tick());
    requestAnimationFrame(() => document.getElementById("loading")?.classList.add("is-hidden"));
  }

  start(): void {
    if (this.mode !== "waiting") return;
    this.mode = "cinematic";
    this.modeTime = 0;
    this.speed = 18;
    this.root.classList.add("is-cinematic");
    document.getElementById("boot")?.classList.add("is-hidden");
    document.getElementById("hud")?.classList.add("is-visible");
    this.startAudio();
  }

  takeControl(): void {
    if (this.mode === "waiting") this.start();
    this.mode = "drive";
    this.modeTime = 0;
    this.root.classList.remove("is-cinematic");
    document.getElementById("skip")?.classList.add("is-hidden");
    if (this.mobile) document.getElementById("mobile-controls")?.classList.add("is-visible");
  }

  private tick(): void {
    requestAnimationFrame(() => this.tick());
    const delta = Math.min(this.clock.getDelta(), .04);
    this.modeTime += delta;
    if (this.mode !== "waiting") this.updateDriving(delta);
    this.updateCamera(delta);
    const environmentPose = this.track.getPose(this.progress, this.laneOffset);
    this.environment.update(delta, this.auto.group.position, this.speed, environmentPose.tangent, environmentPose.side);
    this.updateHud();
    this.updateAudio();
    if (!this.contextLost) this.renderer.render(this.scene, this.camera);
  }

  private updateDriving(delta: number): void {
    const cinematicThrottle = this.mode === "cinematic" ? THREE.MathUtils.smoothstep(this.modeTime, 0, 7) : 1;
    const accelerate = this.mode === "cinematic" || this.input.isHeld("accelerate") || this.mobile;
    const brake = this.input.isHeld("brake");
    const steeringInput = (this.input.isHeld("left") ? -1 : 0) + (this.input.isHeld("right") ? 1 : 0);
    const driftHeld = this.input.isHeld("drift") && Math.abs(steeringInput) > .1 && this.speed > 48;

    const targetSpeed = brake ? 24 : accelerate ? (driftHeld ? 118 : 136) : 66;
    const acceleration = targetSpeed > this.speed ? 32 : 48;
    this.speed = THREE.MathUtils.damp(this.speed, targetSpeed * cinematicThrottle, acceleration / 100, delta);
    this.steer = THREE.MathUtils.damp(this.steer, steeringInput, 8.5, delta);
    this.drift = THREE.MathUtils.damp(this.drift, driftHeld ? Math.sign(steeringInput) : 0, driftHeld ? 4.2 : 8, delta);
    this.lateralVelocity += this.steer * delta * (driftHeld ? 17 : 10.5);
    this.lateralVelocity *= Math.exp(-delta * (driftHeld ? 1.65 : 5.2));
    this.laneOffset += this.lateralVelocity * delta;
    this.laneOffset = THREE.MathUtils.clamp(this.laneOffset, -this.track.width + 2.1, this.track.width - 2.1);
    this.progress = (this.progress + (this.speed / 3.6) / this.track.length * delta) % 1;
    this.placeAuto();
    const vehiclePose = this.vehicleDynamics.update(delta, this.speed, this.steer, this.drift, brake);
    this.auto.update(delta, this.speed, this.steer, this.drift, vehiclePose);

    if (this.mode === "cinematic" && this.modeTime > 9.8) this.takeControl();
  }

  private placeAuto(): void {
    const pose = this.track.getPose(this.progress, this.laneOffset);
    this.auto.group.position.copy(pose.position).setY(.08);
    const heading = Math.atan2(pose.tangent.x, pose.tangent.z);
    this.auto.group.rotation.y = heading - this.drift * .2;
  }

  private updateCamera(delta: number): void {
    const pose = this.track.getPose(this.progress, this.laneOffset);
    const up = new THREE.Vector3(0, 1, 0);
    const desired = new THREE.Vector3();
    const lookAt = this.auto.group.position.clone().addScaledVector(up, 1.05);

    if (this.mode === "waiting") {
      const orbit = performance.now() * .00012;
      desired.copy(this.auto.group.position).add(new THREE.Vector3(Math.sin(orbit) * 7.6, 3.1, Math.cos(orbit) * 7.6));
      lookAt.y += .45;
    } else if (this.mode === "cinematic") {
      const t = this.modeTime;
      if (t < 2.7) {
        desired.copy(this.auto.group.position).addScaledVector(pose.side, -5.4).addScaledVector(pose.tangent, 2.2).addScaledVector(up, 1.7);
      } else if (t < 5.6) {
        const sweep = THREE.MathUtils.smoothstep(t, 2.7, 5.6);
        desired.copy(this.auto.group.position)
          .addScaledVector(pose.side, THREE.MathUtils.lerp(-3.8, 3.1, sweep))
          .addScaledVector(pose.tangent, THREE.MathUtils.lerp(-1.5, -5.4, sweep))
          .addScaledVector(up, THREE.MathUtils.lerp(1.1, 2.5, sweep));
      } else {
        desired.copy(this.auto.group.position).addScaledVector(pose.tangent, -7.2).addScaledVector(pose.side, .75).addScaledVector(up, 2.15);
      }
    } else {
      desired.copy(this.auto.group.position)
        .addScaledVector(pose.tangent, -6.25 - this.speed * .007)
        .addScaledVector(pose.side, this.steer * .45)
        .addScaledVector(up, 1.92);
      lookAt.addScaledVector(pose.tangent, 5.5 + this.speed * .018);
    }

    const follow = 1 - Math.exp(-delta * (this.mode === "cinematic" ? 2.2 : 6.5));
    this.camera.position.lerp(desired, follow);
    this.camera.lookAt(lookAt);
    const targetFov = this.mode === "drive" ? 48 + Math.max(0, this.speed - 70) * .07 : 46;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 4, delta);
    this.camera.updateProjectionMatrix();
  }

  private addLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0x7899aa, 0x211b19, .62);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(0xffb676, 1.28);
    sun.position.set(-72, 52, -38);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.mobile ? 512 : 1024, this.mobile ? 512 : 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 230;
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.bias = -.00025;
    this.scene.add(sun);
  }


  private bindUi(): void {
    document.getElementById("start")?.addEventListener("click", () => this.start());
    document.getElementById("skip")?.addEventListener("click", () => this.takeControl());
  }

  private updateHud(): void {
    const speed = document.getElementById("speed");
    if (speed) speed.textContent = Math.round(this.speed).toString().padStart(3, "0");
    const boost = document.getElementById("boost");
    if (boost) boost.style.width = `${THREE.MathUtils.clamp((this.speed - 45) / 95 * 100, 0, 100)}%`;
    const district = document.getElementById("district");
    if (district) {
      district.textContent = theme.districts[Math.floor(this.progress * theme.districts.length) % theme.districts.length];
    }
  }

  private startAudio(): void {
    try {
      this.audioContext = new AudioContext();
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      oscillator.type = "sawtooth";
      oscillator.frequency.value = 45;
      filter.type = "lowpass";
      filter.frequency.value = 560;
      filter.Q.value = 2.2;
      gain.gain.value = .0001;
      oscillator.connect(filter).connect(gain).connect(this.audioContext.destination);
      oscillator.start();
      void this.audioContext.resume();
      gain.gain.exponentialRampToValueAtTime(.11, this.audioContext.currentTime + .6);
      this.engineOscillator = oscillator;
      this.engineGain = gain;
    } catch {
      // The visual benchmark remains functional when Web Audio is unavailable.
    }
  }

  private updateAudio(): void {
    if (!this.audioContext || !this.engineOscillator || !this.engineGain) return;
    const now = this.audioContext.currentTime;
    this.engineOscillator.frequency.setTargetAtTime(42 + this.speed * 1.35, now, .06);
    this.engineGain.gain.setTargetAtTime(.075 + this.speed / 1800, now, .08);
  }

  private resize(): void {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }
}
