import "./style.css";
import { App } from "./game/App";

const root = document.querySelector<HTMLElement>("#app");
const canvas = document.querySelector<HTMLCanvasElement>("#game");

if (!root || !canvas) throw new Error("Game root is missing");

new App(root, canvas);
