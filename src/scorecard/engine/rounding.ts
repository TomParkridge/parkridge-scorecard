// Python's round(x) and round(x, -2) round the exact binary value of x and send exact halves
// to the even neighbour (2650 -> 2600, 2750 -> 2800). x % step is exact for doubles, and so is
// x - r, so comparing the remainder with step / 2 reproduces Python bit for bit.
export function roundHalfEven(x: number, step = 1): number {
  if (!Number.isFinite(x) || x < 0) throw new RangeError(`roundHalfEven expects a finite value >= 0, got ${x}`);
  const r = x % step;
  const down = x - r;
  const half = step / 2;
  if (r < half) return down;
  if (r > half) return down + step;
  return (down / step) % 2 === 0 ? down : down + step;
}

// Used for the stored scores, which are multiples of 0.25, so x + 0.5 is exact.
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}
