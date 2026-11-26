"use client";

import { useEffect, useRef } from "react";

import styles from "./fracture.module.css";
import { FRAGMENT, VERTEX } from "./shader";

/** The plates drift slowly, so a few frames a second is enough. */
const FPS = 12;
/** Seconds from untouched glass to every plate at its full drift. */
const DURATION_SECONDS = 300;
/** How far each plate drifts, in plates: 0.2 is a fifth of one plate's width. */
const MAX_SPREAD = 0.2;
/** How far a still backdrop (Motion off, or reduced motion) has got. */
const STILL_SECONDS = 0;
const MAX_SCALE = 1.5;

export function FractureBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl", { antialias: false });
    if (!canvas || !gl) return;
    const program = link(gl);
    if (!program) return;

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const u = {
      res: uniform("uRes"),
      impact: uniform("uImpact"),
      seed: uniform("uSeed"),
      progress: uniform("uProgress"),
      maxSpread: uniform("uMaxSpread"),
      furthest: uniform("uFurthest"),
      time: uniform("uTime"),
      shade: uniform("uShade"),
      glint: uniform("uGlint"),
      rift: uniform("uRift"),
      strength: uniform("uStrength"),
    };
    gl.uniform2f(u.seed, Math.random() * 100, Math.random() * 100);
    // Where the glass was struck, as fractions of the screen from the left and the top: the
    // hero's open left margin, so the smash is not hidden behind the content.
    const impact = { x: 0.06 + Math.random() * 0.14, y: 0.15 + Math.random() * 0.3 };

    const html = document.documentElement;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const darkScheme = matchMedia("(prefers-color-scheme: dark)");
    let moving: boolean | undefined;
    let elapsed = 0;
    let last = 0;
    let frame = 0;

    function resize() {
      const scale = Math.min(devicePixelRatio, MAX_SCALE);
      canvas!.width = Math.round(canvas!.clientWidth * scale);
      canvas!.height = Math.round(canvas!.clientHeight * scale);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
    }

    function readColours() {
      const style = getComputedStyle(canvas!);
      const rgb = (name: string) => {
        const [r = 0, g = 0, b = 0] = style.getPropertyValue(name).trim().split(/\s+/).map(Number);
        return [r, g, b] as const;
      };
      gl!.uniform3f(u.shade, ...rgb("--plate-shade"));
      gl!.uniform3f(u.glint, ...rgb("--plate-glint"));
      gl!.uniform3f(u.rift, ...rgb("--plate-rift"));
      gl!.uniform1f(u.strength, Number(style.getPropertyValue("--plate-strength")) || 0);
    }

    function draw() {
      const { width, height } = canvas!;
      const side = Math.min(width, height);
      const ix = (impact.x * width) / side;
      const iy = ((1 - impact.y) * height) / side;

      gl!.uniform2f(u.res, width, height);
      gl!.uniform2f(u.impact, ix, iy);
      gl!.uniform1f(
        u.furthest,
        Math.hypot(Math.max(ix, width / side - ix), Math.max(iy, height / side - iy)),
      );
      gl!.uniform1f(u.progress, Math.min(elapsed / DURATION_SECONDS, 1));
      gl!.uniform1f(u.maxSpread, MAX_SPREAD);
      gl!.uniform1f(u.time, elapsed);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    function tick(now: number) {
      frame = requestAnimationFrame(tick);
      if (last !== 0 && now - last < 1000 / FPS) return;
      // Capped, so a tab coming back from the background does not jump ahead.
      if (last !== 0) elapsed += Math.min((now - last) / 1000, 0.25);
      last = now;
      draw();
    }

    function refresh() {
      const nowMoving = html.dataset.backdropMotion !== "off" && !reducedMotion.matches;
      // Either way, the glass goes back to untouched.
      if (nowMoving !== moving) elapsed = nowMoving ? 0 : STILL_SECONDS;
      moving = nowMoving;
      readColours();
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
  }, []);

  return <canvas ref={ref} className={styles.fracture} />;
}

/** One triangle that covers the screen, and the program that draws it. */
function link(gl: WebGLRenderingContext): WebGLProgram | null {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("fracture backdrop:", gl.getShaderInfoLog(shader));
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
