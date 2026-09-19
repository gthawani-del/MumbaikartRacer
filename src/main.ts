import "./style.css";
import { App } from "./game/App";
import RAPIER from "@dimforge/rapier3d-compat";

const root = document.querySelector<HTMLElement>("#app");
const canvas = document.querySelector<HTMLCanvasElement>("#game");

if (!root || !canvas) throw new Error("Game root is missing");

async function boot(): Promise<void> {
  await RAPIER.init();
  new App(root!, canvas!);
}

boot().catch((error) => {
  console.error("Unable to start the 3D renderer", error);
  document.getElementById("loading")?.classList.add("is-hidden");
  const boot = document.getElementById("boot");
  if (boot) {
    boot.innerHTML = `
      <div class="boot__eyebrow">GRAPHICS SUPPORT REQUIRED</div>
      <h1>MUMBAI<br /><span>AUTO RUSH</span></h1>
      <p>This cinematic prototype needs WebGL. Please open it in an up-to-date version of Safari, Chrome, Edge or Firefox with hardware acceleration enabled.</p>
    `;
  }
});
