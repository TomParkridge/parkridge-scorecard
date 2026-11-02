import { describe, expect, it, vi } from 'vitest';
import { captureTraffic, readTraffic } from './traffic.ts';

const fakeStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

describe('readTraffic', () => {
  it('reads UTMs, referrer and landing path', () => {
    expect(readTraffic('?utm_source=meta&utm_medium=paid&utm_campaign=launch&x=1', 'https://facebook.com/', '/')).toEqual({
      utmSource: 'meta',
      utmMedium: 'paid',
      utmCampaign: 'launch',
      referrer: 'https://facebook.com/',
      landingPath: '/',
    });
  });

  it('gives nulls when there is nothing to read', () => {
    expect(readTraffic('', '', '')).toEqual({ utmSource: null, utmMedium: null, utmCampaign: null, referrer: null, landingPath: null });
  });
});

describe('captureTraffic', () => {
  const first = readTraffic('?utm_source=meta', 'https://facebook.com/', '/');
  const second = readTraffic('?utm_source=google', '', '/other');

  it('keeps the first values in a session', () => {
    const storage = fakeStorage();
    expect(captureTraffic(storage, first)).toEqual(first);
    expect(captureTraffic(storage, second)).toEqual(first);
  });

  it('still returns this page load when storage throws', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(captureTraffic(blocked, first)).toEqual(first);
  });

  it('still returns this page load when reading window.sessionStorage itself throws', () => {
    vi.stubGlobal('window', {
      get sessionStorage() {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(captureTraffic(undefined, first)).toEqual(first);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('recovers from a corrupt saved value', () => {
    const storage = fakeStorage();
    storage.setItem('scorecard_traffic', '{not json');
    expect(captureTraffic(storage, first)).toEqual(first);
  });
});
