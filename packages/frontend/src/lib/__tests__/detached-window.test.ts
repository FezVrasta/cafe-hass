import { describe, expect, it } from 'vitest';
import { getDetachedAppUrl } from '../detached-window';

describe('detached-window', () => {
  it('builds the standalone app URL without leaking tokens in query params', () => {
    const url = getDetachedAppUrl('https://example.local:8123');

    expect(url).toBe('https://example.local:8123/cafe-hass/index.html');
    expect(url.includes('?')).toBe(false);
    expect(url.includes('token=')).toBe(false);
  });
});

