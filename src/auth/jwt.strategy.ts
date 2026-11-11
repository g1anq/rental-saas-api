import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { getJwtSecret } from './jwt-secret.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
    const { password, ...result } = landlord as any;
    return { ...result, role: 'landlord' };
  }
}
