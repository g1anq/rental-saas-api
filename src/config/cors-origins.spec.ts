import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCorsOrigins, validateProductionSecurity } from './cors-origins.js';

describe('CORS configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the local web origin outside production', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CORS_ORIGINS', '');

    expect(getCorsOrigins()).toEqual(['http://localhost:3000']);
  });

  it('parses and deduplicates configured origins', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CORS_ORIGINS', 'http://localhost:3000, http://127.0.0.1:3000,http://localhost:3000');

    expect(getCorsOrigins()).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
  });

  it('requires an HTTPS origin and a Secure cookie in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGINS', 'http://app.example.com');
    vi.stubEnv('COOKIE_SECURE', 'false');

    expect(() => getCorsOrigins()).toThrow('CORS origin must use HTTPS in production');
    expect(() => validateProductionSecurity()).toThrow('COOKIE_SECURE must be true');
  });

  it('accepts a configured HTTPS origin and secure cookie in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGINS', 'https://app.example.com');
    vi.stubEnv('COOKIE_SECURE', 'true');

    expect(getCorsOrigins()).toEqual(['https://app.example.com']);
    expect(validateProductionSecurity()).toBeUndefined();
  });
});
