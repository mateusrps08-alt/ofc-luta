export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export const TAU = Math.PI * 2;

// easing
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export type Vec = { x: number; y: number };

// point at distance/angle from origin (screen coords, y down)
export const polar = (o: Vec, ang: number, len: number): Vec => ({
  x: o.x + Math.cos(ang) * len,
  y: o.y + Math.sin(ang) * len,
});
