import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { MailModule } from '../mail/mail.module.js';
import { TenantNotificationsGateway } from './tenant-notifications.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [MailModule, AuthModule, PrismaModule],
  providers: [NotificationsService, TenantNotificationsGateway],
  exports: [NotificationsService, TenantNotificationsGateway],
})
export class NotificationsModule {}
