import { describe, expect, it } from 'vitest';
import { isProduction } from './env';

describe('isProduction', () => {
  it('is true only on the custom domain', () => {
    expect(isProduction('scorecard.parkridgeadvisory.com')).toBe(true);
  });

  it('is false on Vercel previews, the git-main alias and localhost', () => {
    expect(isProduction('parkridge-scorecard-9g5gybo4m-tom-8931s-projects.vercel.app')).toBe(false);
    expect(isProduction('parkridge-scorecard-git-scorecard-v2-tom-8931s-projects.vercel.app')).toBe(false);
    expect(isProduction('parkridge-scorecard-git-main-tom-8931s-projects.vercel.app')).toBe(false);
    expect(isProduction('localhost')).toBe(false);
    expect(isProduction('127.0.0.1')).toBe(false);
  });

  it('does not match lookalike hosts', () => {
    expect(isProduction('scorecard.parkridgeadvisory.com.evil.example')).toBe(false);
    expect(isProduction('www.scorecard.parkridgeadvisory.com')).toBe(false);
  });
});
