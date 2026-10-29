import { describe, expect, it } from 'vitest';
import { roundHalfEven, roundHalfUp } from './rounding.ts';

describe('roundHalfEven to $100 (Python round(x, -2))', () => {
  it('sends exact halves to the even hundred', () => {
    expect(roundHalfEven(2650, 100)).toBe(2600);
    expect(roundHalfEven(2750, 100)).toBe(2800);
    expect(roundHalfEven(250, 100)).toBe(200);
    expect(roundHalfEven(350, 100)).toBe(400);
    expect(roundHalfEven(50, 100)).toBe(0);
    expect(roundHalfEven(150, 100)).toBe(200);
  });

  it('rounds values just off a half by their exact binary value', () => {
    expect(roundHalfEven(2650.0000000000005, 100)).toBe(2700);
    expect(roundHalfEven(2649.9999999999995, 100)).toBe(2600);
    expect(roundHalfEven(2797.6, 100)).toBe(2800);
    expect(roundHalfEven(5402.25, 100)).toBe(5400);
  });

  it('leaves multiples of 100 alone', () => {
    expect(roundHalfEven(0, 100)).toBe(0);
    expect(roundHalfEven(5200, 100)).toBe(5200);
  });

  it('rejects negative and non-finite values', () => {
    expect(() => roundHalfEven(-1, 100)).toThrow(RangeError);
    expect(() => roundHalfEven(Number.NaN, 100)).toThrow(RangeError);
  });
});

describe('roundHalfEven to whole numbers (Python round(x))', () => {
  it('matches Python for halves and near-halves', () => {
    expect(roundHalfEven(0.5)).toBe(0);
    expect(roundHalfEven(1.5)).toBe(2);
    expect(roundHalfEven(2.5)).toBe(2);
    expect(roundHalfEven(17.5)).toBe(18);
    expect(roundHalfEven(14.499999999999998)).toBe(14);
    expect(roundHalfEven(0.175 * 100)).toBe(18); // 17.5 exactly in binary
  });
});

describe('roundHalfUp', () => {
  it('rounds halves up', () => {
    expect(roundHalfUp(29.5)).toBe(30);
    expect(roundHalfUp(39.25)).toBe(39);
    expect(roundHalfUp(69.5)).toBe(70);
    expect(roundHalfUp(0)).toBe(0);
  });
});
