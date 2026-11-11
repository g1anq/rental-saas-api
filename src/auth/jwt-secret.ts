import { ConfigService } from '@nestjs/config';

export function getJwtSecret(config: ConfigService): string {
  const secret = config.getOrThrow<string>('JWT_SECRET');
  if (secret.length < 32 || /^(change|replace|your)[-_ ]/i.test(secret)) {
    throw new Error('JWT_SECRET must be a unique secret of at least 32 characters.');
  }
  return secret;
}
