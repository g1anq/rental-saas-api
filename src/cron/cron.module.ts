import { Module } from '@nestjs/common';
import { CronService } from './cron.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [NotificationsModule, PrismaModule],
  providers: [CronService],
})
export class CronModule {}
