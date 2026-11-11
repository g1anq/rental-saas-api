import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // No roles required
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Chưa xác thực người dùng');
    }

    // Mặc định, nếu không có role trong JWT payload thì coi như là landlord (cho tương thích ngược)
    const userRole = user.role || 'landlord';

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException('Bạn không có quyền truy cập chức năng này');
    }

    return true;
  }
}
