import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { getJwtSecret } from './jwt-secret.js';
import type { Request } from 'express';
import { getAuthCookieToken } from './auth-cookie.js';

function extractAuthCookie(request: Request): string | null {
  return getAuthCookieToken(request.headers.cookie);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractAuthCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(config),
    });
  }

  async validate(payload: { sub: string; email?: string; role?: string }) {
    if (payload.role === 'tenant') {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: payload.sub },
      });
      if (!tenant) throw new UnauthorizedException();
      return { ...tenant, role: 'tenant' };
    }

    const landlord = await this.prisma.landlord.findUnique({
      where: { id: payload.sub },
    });

    if (!landlord) {
      throw new UnauthorizedException();
    }

    // We omit password so it's not injected into the request object
    const { password: _password, ...result } = landlord;
    return { ...result, role: 'landlord' };
  }
}
