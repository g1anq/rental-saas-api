import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_COOKIE_NAME, getAuthCookieOptions, getAuthCookieToken } from './auth-cookie.js';

describe('getAuthCookieToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('extracts the session token from a cookie header', () => {
    expect(getAuthCookieToken(`other=value; ${AUTH_COOKIE_NAME}=jwt.token.signature`))
      .toBe('jwt.token.signature');
  });

  it('decodes an encoded token and rejects malformed cookie values', () => {
    expect(getAuthCookieToken(`${AUTH_COOKIE_NAME}=jwt%2Etoken`)).toBe('jwt.token');
    expect(getAuthCookieToken(`${AUTH_COOKIE_NAME}=%E0%A4%A`)).toBeNull();
  });

  it('returns null when the session cookie is absent', () => {
    expect(getAuthCookieToken('other=value')).toBeNull();
    expect(getAuthCookieToken()).toBeNull();
  });

  it('marks production cookies Secure', () => {
    vi.stubEnv('COOKIE_SECURE', 'true');
    expect(getAuthCookieOptions().secure).toBe(true);
  });
});
