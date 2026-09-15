import * as THREE from "three";

export type GlTry = {
  antialias: boolean;
  powerPreference: WebGLPowerPreference;
  failIfMajorPerformanceCaveat?: boolean;
};

/**
 * Brave/Chromium on Linux (NVIDIA, hybrid GPU, Wayland) often fails the first
 * `high-performance` WebGL request and then poisons that canvas. Retry on a
 * fresh canvas with milder attributes.
 */
export const GL_CONTEXT_TRIES: GlTry[] = [
  { antialias: true, powerPreference: "high-performance" },
  { antialias: true, powerPreference: "default" },
  { antialias: false, powerPreference: "default" },
  { antialias: false, powerPreference: "low-power", failIfMajorPerformanceCaveat: false },
];

export type RendererFactory = new (params: THREE.WebGLRendererParameters) => THREE.WebGLRenderer;

export function replaceCanvas(old: HTMLCanvasElement): HTMLCanvasElement {
  const next = document.createElement("canvas");
  next.id = old.id;
  for (const attr of Array.from(old.attributes)) {
    if (attr.name === "id") continue;
    next.setAttribute(attr.name, attr.value);
  }
  old.replaceWith(next);
  return next;
}

export function createGameRenderer(
  canvas: HTMLCanvasElement,
  Renderer: RendererFactory = THREE.WebGLRenderer,
  freshCanvas: (old: HTMLCanvasElement) => HTMLCanvasElement = replaceCanvas,
): { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement; tryIndex: number } {
  let target = canvas;
  let last: unknown;
  for (let i = 0; i < GL_CONTEXT_TRIES.length; i++) {
    if (i > 0) target = freshCanvas(target);
    try {
      const renderer = new Renderer({ canvas: target, ...GL_CONTEXT_TRIES[i] });
      return { renderer, canvas: target, tryIndex: i };
    } catch (err) {
      last = err;
    }
  }
  throw last instanceof Error ? last : new Error("THREE.WebGLRenderer: Error creating WebGL context.");
}
