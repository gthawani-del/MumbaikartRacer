export type Control = "left" | "right" | "accelerate" | "brake" | "drift";

export class Input {
  private held = new Set<Control>();

  constructor(root: HTMLElement) {
    const keyMap: Record<string, Control> = {
      ArrowLeft: "left", KeyA: "left",
      ArrowRight: "right", KeyD: "right",
      ArrowUp: "accelerate", KeyW: "accelerate",
      ArrowDown: "brake", KeyS: "brake",
      Space: "drift",
    };

    window.addEventListener("keydown", (event) => {
      const control = keyMap[event.code];
      if (!control) return;
      event.preventDefault();
      this.held.add(control);
    });

    window.addEventListener("keyup", (event) => {
      const control = keyMap[event.code];
      if (control) this.held.delete(control);
    });

    root.querySelectorAll<HTMLButtonElement>("[data-control]").forEach((button) => {
      const control = button.dataset.control as Control;
      const press = (event: Event) => {
        event.preventDefault();
        this.held.add(control);
        button.classList.add("is-active");
      };
      const release = (event: Event) => {
        event.preventDefault();
        this.held.delete(control);
        button.classList.remove("is-active");
      };
      button.addEventListener("pointerdown", press);
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("pointerleave", release);
    });
  }

  isHeld(control: Control): boolean {
    return this.held.has(control);
  }
}
