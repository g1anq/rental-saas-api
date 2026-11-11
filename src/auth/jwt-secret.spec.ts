import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { getJwtSecret } from './jwt-secret.js';

describe('getJwtSecret', () => {
  it('returns a configured secret with sufficient length', () => {
    const secret = 'a'.repeat(32);
    const config = new ConfigService({ JWT_SECRET: secret });

    expect(getJwtSecret(config)).toBe(secret);
  });

  it('rejects missing and placeholder secrets', () => {
    expect(() => getJwtSecret(new ConfigService({}))).toThrow();
    expect(() =>
      getJwtSecret(
        new ConfigService({
          JWT_SECRET: 'replace-with-a-random-secret-at-least-32-characters',
        }),
      ),
    ).toThrow(/unique secret/i);
  });
});
