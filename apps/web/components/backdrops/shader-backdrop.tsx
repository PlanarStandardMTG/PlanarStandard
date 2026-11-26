"use client";

import { useEffect, useRef } from "react";

export interface Uniforms {
  float(name: string, x: number): void;
  vec2(name: string, x: number, y: number): void;
}

export interface Frame {
  /** Seconds the effect has been moving, from 0 each time motion is turned on. */
  elapsed: number;
  width: number;
  height: number;
}

/** One WebGL backdrop: a fragment shader drawn over the whole canvas. */
export interface Scene {
  fragment: string;
  fps: number;
  /**
   * Uniforms read from the canvas's CSS custom properties whenever the theme
   * changes: "r g b" in 0–1 for a vec3, a bare number for a float.
   */
  style: Readonly<Record<string, string>>;
  /** Runs once per mount, so per-visit randomness lives in its closure; returns the per-frame update. */
  start(set: Uniforms): (set: Uniforms, frame: Frame) => void;
}

const VERTEX = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const MAX_SCALE = 1.5;

/**
 * Runs a `Scene` behind the page. It also sets `uRes` (canvas pixels) and
 * `uTime` (the frame's `elapsed`). With motion off — the footer toggle or
 * reduced motion — it draws nothing, and turning motion on starts from 0.
 */
export function ShaderBackdrop({
  scene,
  className,
}: {
  scene: Scene;
  className: string | undefined;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl", { antialias: false });
    if (!canvas || !gl) return;
    const program = link(gl, scene.fragment);
    if (!program) return;

    const locations = new Map<string, WebGLUniformLocation | null>();
    const at = (name: string) => {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
      return locations.get(name) ?? null;
    };
    const set: Uniforms = {
      float: (name, x) => gl.uniform1f(at(name), x),
      vec2: (name, x, y) => gl.uniform2f(at(name), x, y),
    };
    const update = scene.start(set);

    const html = document.documentElement;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const darkScheme = matchMedia("(prefers-color-scheme: dark)");
    let moving = false;
    let elapsed = 0;
    let last = 0;
    let frame = 0;

    function resize() {
      const scale = Math.min(devicePixelRatio, MAX_SCALE);
      canvas!.width = Math.round(canvas!.clientWidth * scale);
      canvas!.height = Math.round(canvas!.clientHeight * scale);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
    }

    function readStyle() {
      const style = getComputedStyle(canvas!);
      for (const [name, property] of Object.entries(scene.style)) {
        const values = style.getPropertyValue(property).trim().split(/\s+/).map(Number);
        const [x = 0, y = 0, z = 0] = values;
        if (values.length === 3) gl!.uniform3f(at(name), x, y, z);
        else gl!.uniform1f(at(name), x);
      }
    }

    function draw() {
      if (!moving) {
        gl!.clearColor(0, 0, 0, 0);
        gl!.clear(gl!.COLOR_BUFFER_BIT);
        return;
      }
      const { width, height } = canvas!;
      set.vec2("uRes", width, height);
      set.float("uTime", elapsed);
      update(set, { elapsed, width, height });
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    function tick(now: number) {
      frame = requestAnimationFrame(tick);
      if (last !== 0 && now - last < 1000 / scene.fps) return;
      // Capped, so a tab coming back from the background does not jump ahead.
      if (last !== 0) elapsed += Math.min((now - last) / 1000, 0.25);
      last = now;
      draw();
    }

    function refresh() {
      const nowMoving = html.dataset.backdropMotion !== "off" && !reducedMotion.matches;
      if (nowMoving !== moving) elapsed = 0;
      moving = nowMoving;
      readStyle();
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      if (moving) frame = requestAnimationFrame(tick);
      else draw();
    }

    resize();
    refresh();

    const resizes = new ResizeObserver(() => {
      resize();
      draw();
    });
    resizes.observe(canvas);
    const settings = new MutationObserver(refresh);
    settings.observe(html, { attributeFilter: ["data-theme", "data-backdrop-motion"] });
    reducedMotion.addEventListener("change", refresh);
    darkScheme.addEventListener("change", refresh);

    return () => {
      cancelAnimationFrame(frame);
      resizes.disconnect();
      settings.disconnect();
      reducedMotion.removeEventListener("change", refresh);
      darkScheme.removeEventListener("change", refresh);
    };
  }, [scene]);

  return <canvas ref={ref} className={className} />;
}

/** One triangle that covers the screen, and the program that draws it. */
function link(gl: WebGLRenderingContext, fragment: string): WebGLProgram | null {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("backdrop shader:", gl.getShaderInfoLog(shader));
      return null;
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  return program;
}
