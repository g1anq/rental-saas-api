export const AUTH_COOKIE_NAME = 'rental_session';

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as const,
    path: '/',
  };
}

export function getAuthCookieToken(cookieHeader?: string): string | null {
  const prefix = `${AUTH_COOKIE_NAME}=`;
  const value = cookieHeader
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length);

  if (!value) return null;

  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
