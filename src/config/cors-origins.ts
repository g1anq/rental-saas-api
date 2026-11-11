export function getCorsOrigins(): string[] {
  const origins = [...new Set(
    (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )];

  if (process.env.NODE_ENV === 'production' && origins.length === 0) {
    throw new Error('CORS_ORIGINS must contain the trusted HTTPS frontend origin in production.');
  }

  for (const origin of origins) {
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }

    if (parsedOrigin.origin !== origin) {
      throw new Error(`CORS origins must not include a path or trailing slash: ${origin}`);
    }

    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsedOrigin.hostname);
    if (
      process.env.NODE_ENV === 'production' &&
      parsedOrigin.protocol !== 'https:' &&
      !isLoopback
    ) {
      throw new Error(`CORS origin must use HTTPS in production: ${origin}`);
    }
  }

  return origins.length > 0 ? origins : ['http://localhost:3000'];
}

export function validateProductionSecurity(): void {
  if (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'true') {
    throw new Error('COOKIE_SECURE must be true in production.');
  }
}
