import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditAction, Prisma } from '@prisma/client';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) { }

  // 1. Thêm phòng mới (Phải truyền đúng landlordId đã có trong DB)
  async create(data: Prisma.RoomUncheckedCreateInput) {
    if (data.propertyId) {
      const property = await this.prisma.property.findFirst({
        where: { id: data.propertyId, landlordId: data.landlordId },
      });
      if (!property) {
        throw new NotFoundException('Không tìm thấy khu nhà trọ');
      }
    }

    return this.prisma.room.create({ data });
  }

  // 2. Lấy danh sách tất cả phòng của chủ trọ (Hỗ trợ phân trang)
  async findAll(landlordId: string, propertyId?: string, page?: number, limit?: number) {
    const where = {
      landlordId,
      ...(propertyId ? { propertyId } : {})
    };

    // Nếu có tham số phân trang
    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.max(1, Number(limit) || 10);
      const skip = (pageNum - 1) * limitNum;

      const [data, total] = await Promise.all([
        this.prisma.room.findMany({
          where,
          include: {
            property: true,
            contracts: {
              where: { isActive: true },
              take: 1
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        this.prisma.room.count({ where }),
      ]);

      return {
        data,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    }

    return this.prisma.room.findMany({
      where,
      include: {
        property: true,
        contracts: {
          where: { isActive: true },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // 3. Cập nhật trạng thái phòng (VD: Đã thuê, Đang bảo trì)
  async update(id: string, landlordId: string, data: Prisma.RoomUncheckedUpdateInput) {
    const { landlordId: _ignoredLandlordId, ...safeData } = data;
    if (typeof safeData.propertyId === 'string') {
      const property = await this.prisma.property.findFirst({
        where: { id: safeData.propertyId, landlordId },
      });
      if (!property) {
        throw new NotFoundException('Không tìm thấy khu nhà trọ');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.findFirst({ where: { id, landlordId } });
      if (!room) {
        throw new NotFoundException('Không tìm thấy phòng');
      }

      const updatedRoom = await tx.room.update({
        where: { id },
        data: safeData,
      });

      if (typeof safeData.price === 'number' && safeData.price !== room.price) {
        await tx.auditLog.create({
          data: {
            landlordId,
            action: AuditAction.ROOM_PRICE_CHANGED,
            entityType: 'Room',
            entityId: room.id,
            details: { oldPrice: room.price, newPrice: safeData.price },
          },
        });
      }

      return updatedRoom;
    });
  }

  // 4. Xóa phòng
  async remove(id: string, landlordId: string) {
    const room = await this.prisma.room.findFirst({ where: { id, landlordId } });
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng');
    }

    return this.prisma.room.delete({
      where: { id },
    });
  }
}
