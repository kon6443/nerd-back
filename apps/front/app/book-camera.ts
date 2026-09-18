type Point = [number, number, number];

export function bookCamera(entry: number, aspect: number) {
  const progress = Number.isFinite(entry) ? Math.max(0, Math.min(1, entry)) : 0;
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const fit = Math.max(1, 0.9 / ratio);
  const start: Point = [9 * fit, 0.65 + 7.85 * fit, 11 * fit];
  const control: Point = [start[0] * 0.5 + 0.7, start[1] * 0.62, start[2] * 0.66];
  const courtyard: Point = [1.4, 1.22, 2];
  const door: Point = [1.4, 1.08, 0.05];
  const t = progress * progress * (3 - 2 * progress);
  const remaining = 1 - t;
  const position = start.map((v, i) => remaining ** 3 * v + 3 * remaining ** 2 * t * control[i] + 3 * remaining * t ** 2 * courtyard[i] + t ** 3 * door[i]) as Point;
  const aim = Math.min(1, progress * 1.7);
  const centered = aim * aim * (3 - 2 * aim);

  return {
    position,
    target: [1.4 * centered, 0.65 + 0.39 * centered, -0.6 * centered] as Point,
    offset: { x: ratio < 0.85 ? 0 : -0.18 * (1 - centered), y: ratio < 0.85 ? -0.07 * (1 - centered) : 0 },
  };
}
