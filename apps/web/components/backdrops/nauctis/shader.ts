/**
 * Light rain over water that rises from the bottom of the screen. Above the
 * surface: slanting streaks in three layers of columns, each column one drop
 * at its own pace. Below: a tint that deepens with depth, caustic light, slow
 * rays and rising bubbles. Once `uLevel` passes the top, it is all underwater.
 * Coordinates are in units of the screen's shorter side, so nothing stretches.
 */
export const FRAGMENT = `
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uLevel;
uniform vec3 uRain;
uniform vec3 uWater;
uniform vec3 uLight;
uniform float uStrength;

const float TAU = 6.2831853;

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

float noise(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
}

float rain(vec2 uv, float px) {
  float total = 0.0;
  for (int i = 0; i < 3; i++) {
    float layer = float(i);
    float columns = 55.0 + layer * 35.0;
    vec2 q = vec2(uv.x + uv.y * 0.12, uv.y);
    float c = floor(q.x * columns) + layer * 1000.0;
    float across = abs(fract(q.x * columns) - 0.5) / columns;

    // Roughly screens a second: slow enough to follow by eye; the nearer layers fall faster.
    float speed = 0.5 - layer * 0.1 + hash(c) * 0.2;
    float spacing = 1.2 + hash(c + 7.0) * 1.0;
    float behind = fract((q.y + uTime * speed) / spacing + hash(c + 3.0)) * spacing;
    float tail = 0.12 - layer * 0.025;

    // Brightest at the head, fading up the tail.
    float streak = smoothstep(tail, 0.0, behind) * smoothstep(0.0, px * 3.0, behind);
    float line = 1.0 - smoothstep(px * 0.6, px * 1.6, across);
    float falling = step(0.4, hash(c + 11.0));
    total += streak * line * falling * (1.0 - layer * 0.25);
  }
  return min(total, 1.0);
}

// Light focused by a moving surface, as webs that drift and re-form.
float caustic(vec2 uv, float t) {
  vec2 p = uv * TAU * 1.3 - 250.0;
  vec2 i = p;
  float c = 1.0;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - 3.5 / float(n + 1));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));
  }
  c = 1.17 - pow(c / 4.0, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.0);
}

float bubbles(vec2 uv, float depth, float px) {
  const float COLUMNS = 14.0;
  float c = floor(uv.x * COLUMNS);
  float x = (fract(uv.x * COLUMNS) - 0.5) / COLUMNS + (hash(c + 5.0) - 0.5) * 0.03;
  float speed = 0.06 + hash(c + 9.0) * 0.06;
  float spacing = 0.8 + hash(c + 2.0);
  float y = (fract((uv.y - uTime * speed) / spacing + hash(c)) - 0.5) * spacing;
  float radius = 0.003 + hash(c + 4.0) * 0.004;
  float ring = abs(length(vec2(x + sin(uTime * 2.0 + c) * 0.004, y)) - radius);
  return (1.0 - smoothstep(px * 0.3, px * 1.3, ring)) * step(0.5, hash(c + 13.0)) * step(0.03, depth);
}

vec4 over(vec4 dst, vec3 colour, float alpha) {
  return vec4(colour * alpha, alpha) + dst * (1.0 - alpha);
}

void main() {
  float side = min(uRes.x, uRes.y);
  float px = 1.0 / side;
  vec2 uv = gl_FragCoord.xy / side;

  float surface = uLevel * uRes.y / side
    + 0.006 * sin(uv.x * 9.0 + uTime * 1.3)
    + 0.004 * sin(uv.x * 23.0 - uTime * 2.1)
    + 0.0015 * sin(uv.x * 61.0 + uTime * 3.7);
  float depth = surface - uv.y;
  float under = smoothstep(-px, px, depth);

  vec4 colour = vec4(0.0);
  colour = over(colour, uRain, rain(uv, px) * 0.45 * (1.0 - under));

  float tint = mix(0.1, 0.3, smoothstep(0.0, 1.2, depth));
  colour = over(colour, uWater, tint * under);
  float rays = pow(noise(uv.x * 7.0 + uv.y * 1.8 + uTime * 0.15), 3.0) * exp(-depth * 1.5);
  colour = over(colour, uLight, rays * 0.1 * under);
  float light = caustic(uv, uTime * 0.35) * mix(1.0, 0.45, smoothstep(0.0, 1.2, depth));
  colour = over(colour, uLight, light * 0.22 * under);
  colour = over(colour, uLight, bubbles(uv, depth, px) * 0.3 * under);

  float edge = 1.0 - smoothstep(px * 0.5, px * 2.0, abs(depth));
  colour = over(colour, uLight, edge * 0.5);
  gl_FragColor = colour * uStrength;
}
`;
