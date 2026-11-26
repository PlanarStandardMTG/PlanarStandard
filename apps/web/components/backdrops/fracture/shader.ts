export const VERTEX = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

/**
 * The screen as Voronoi plates of broken glass, drifting apart from an impact.
 * A front runs out from the impact as `uProgress` goes from 0 to 1: the glass
 * cracks where it passes, then each plate there moves and turns a little; a pixel belongs to
 * whichever plate, moved back to where it started, still contains it, and to
 * the rift beneath if none does.
 *
 * The plates are even in a space centred on the impact whose radius is
 * r^SMASH. That space is stretched most near the impact, so pieces there come
 * out small, and stretched more around than outward, so they point away from it.
 */
export const FRAGMENT = `
precision highp float;

uniform vec2 uRes;
uniform vec2 uImpact;
uniform vec2 uSeed;
uniform float uProgress;
uniform float uMaxSpread;
uniform float uFurthest;
uniform float uTime;
uniform vec3 uShade;
uniform vec3 uGlint;
uniform vec3 uRift;
uniform float uStrength;

const float CELLS = 4.5;
const float SMASH = 0.4;

float hash1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

// Kept off the cell's edges, so a 3x3 search always finds the nearest seed.
vec2 seedOf(vec2 g) { return g + 0.15 + 0.7 * hash2(g + uSeed); }

// When the front reaches a point a given distance from the impact, in plate units. It is
// timed by distance on screen, so it runs out at a steady pace rather than racing at the end.
float arrival(float distance) {
  return clamp(pow(distance / CELLS, 1.0 / SMASH) / uFurthest, 0.0, 1.0) * 0.6;
}

// How far a plate has moved: it starts once the front has passed it, then eases to its full drift.
float spread(vec2 g, vec2 s) {
  float start = arrival(length(s)) + hash1(g + uSeed + 53.0) * 0.05;
  return uMaxSpread * smoothstep(start + 0.05, start + 0.4, uProgress);
}

vec2 drift(vec2 g, vec2 s, float amount) {
  vec2 away = normalize(s + 0.0001);
  vec2 wander = hash2(g + uSeed + 17.0) - 0.5;
  return amount * (away * (0.6 + 0.4 * hash1(g + uSeed + 3.0)) + wander);
}

float turn(vec2 g, float amount) { return (hash1(g + uSeed + 29.0) - 0.5) * amount * 0.6; }

mat2 rotation(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, s, -s, c);
}

vec4 over(vec4 dst, vec3 colour, float alpha) {
  return vec4(colour * alpha, alpha) + dst * (1.0 - alpha);
}

void main() {
  float side = min(uRes.x, uRes.y);
  vec2 d = gl_FragCoord.xy / side - uImpact;
  float r = max(length(d), 0.003);
  vec2 local = d / r * pow(r, SMASH) * CELLS;
  vec2 p = local + uSeed;
  // One screen pixel in plate units, averaged over the stretch around and outward.
  float px = CELLS / side * sqrt(SMASH) * pow(r, SMASH - 1.0);
  vec2 base = floor(p);

  // How far inside its plate this pixel is; below zero, it is in a rift.
  float inside = -1.0;
  float plate = 0.0;

  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = base + vec2(float(i), float(j));
    vec2 s = seedOf(g);
    float amount = spread(g, s - uSeed);
    vec2 home = s + rotation(-turn(g, amount)) * (p - drift(g, s - uSeed, amount) - s);

    vec2 hb = floor(home);
    float d1 = 1e9;
    float d2 = 1e9;
    vec2 s1 = vec2(0.0);
    vec2 s2 = vec2(0.0);
    vec2 g1 = vec2(0.0);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 h = hb + vec2(float(x), float(y));
      vec2 t = seedOf(h);
      float d = dot(home - t, home - t);
      if (d < d1) { d2 = d1; s2 = s1; d1 = d; s1 = t; g1 = h; }
      else if (d < d2) { d2 = d; s2 = t; }
    }

    if (g1 == g) {
      float depth = (d2 - d1) / (2.0 * length(s2 - s1));
      if (depth > inside) { inside = depth; plate = hash1(g + uSeed + 41.0); }
    }
  }

  float rift = 1.0 - smoothstep(0.0, px, inside);
  float edge = (1.0 - smoothstep(px * 0.5, px * 2.5, inside)) * (1.0 - rift);
  float tilt = plate - 0.5;
  float glint = pow(0.5 + 0.5 * sin(uTime * 0.3 + plate * 40.0), 30.0) * 0.07;
  // Untouched until the front arrives; then lit edges, which widen into rifts as the plates part.
  float cracked = smoothstep(0.0, 0.08, uProgress - arrival(length(local)));

  vec4 colour = vec4(0.0);
  colour = over(colour, tilt > 0.0 ? uGlint : uShade, abs(tilt) * 0.1 * cracked * (1.0 - rift));
  colour = over(colour, uGlint, glint * (1.0 - rift) * cracked);
  colour = over(colour, uGlint, edge * 0.4 * cracked);
  colour = over(colour, uRift, rift * 0.5 * cracked);
  gl_FragColor = colour * uStrength;
}
`;
