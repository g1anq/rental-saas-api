import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto.js';
import { MaintenanceStatus, MaintenancePriority } from '@prisma/client';

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMaintenanceDto, landlordId: string) {
    return this.prisma.maintenanceRequest.create({
      data: {
        title: dto.title,
        description: dto.description,
        roomId: dto.roomId,
        tenantId: dto.tenantId,
        priority: dto.priority,
      },
      include: {
        room: true,
        tenant: true,
      },
    });
  }

  async findAll(
    landlordId: string,
    propertyId?: string,
    status?: MaintenanceStatus,
    priority?: MaintenancePriority,
    page?: number,
    limit?: number,
  ) {
    const where = {
      room: {
        landlordId,
        ...(propertyId ? { propertyId } : {})
      },
      status,
      priority,
    };

    const include = {
      room: true,
      tenant: true,
    };
    const orderBy: any = { createdAt: 'desc' };

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.max(1, Number(limit) || 10);
      const skip = (pageNum - 1) * limitNum;

      const [data, total] = await Promise.all([
        this.prisma.maintenanceRequest.findMany({
          where,
          include,
          orderBy,
          skip,
          take: limitNum,
        }),
        this.prisma.maintenanceRequest.count({ where }),
      ]);

      return {
        data,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    }

    return this.prisma.maintenanceRequest.findMany({
      where,
      include,
      orderBy,
    });
  }

  async findOne(id: string, landlordId: string) {
    const req = await this.prisma.maintenanceRequest.findFirst({
      where: { id, room: { landlordId } },
      include: { room: true, tenant: true },
    });
    if (!req) throw new NotFoundException(`Không tìm thấy yêu cầu bảo trì ID: ${id}`);
    return req;
  }

  async update(id: string, dto: UpdateMaintenanceDto, landlordId: string) {
    await this.findOne(id, landlordId); // Verify existence

    const updateData: any = { ...dto };
    if (dto.status === MaintenanceStatus.COMPLETED) {
      updateData.resolvedAt = new Date();
    }

    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: updateData,
      include: { room: true, tenant: true },
    });
  }

  async remove(id: string, landlordId: string) {
    await this.findOne(id, landlordId);
    return this.prisma.maintenanceRequest.delete({
      where: { id },
    });
  }
}
