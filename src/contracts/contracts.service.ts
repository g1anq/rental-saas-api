import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateContractDto } from './dto/create-contract.dto.js';
import { UpdateContractDto } from './dto/update-contract.dto.js';
import { CreateUtilityReadingDto } from './dto/create-utility-reading.dto.js';
import { AuditAction, RoomStatus } from '@prisma/client';

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  // Tạo hợp đồng mới + tự động đổi trạng thái phòng thành RENTED
  async create(dto: CreateContractDto, landlordId: string) {
    // Kiểm tra phòng tồn tại, thuộc về chủ nhà và đang trống
    const room = await this.prisma.room.findUnique({ where: { id: dto.roomId, landlordId } });
    if (!room) throw new NotFoundException(`Không tìm thấy phòng ID: ${dto.roomId}`);
    if (room.status !== RoomStatus.AVAILABLE) {
      throw new ConflictException(`Phòng "${room.name}" hiện không trống (status: ${room.status})`);
    }

    // Kiểm tra khách thuê tồn tại và thuộc về chủ nhà
    const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenantId, landlordId } });
    if (!tenant) throw new NotFoundException(`Không tìm thấy khách thuê ID: ${dto.tenantId}`);

    // Tạo hợp đồng + cập nhật trạng thái phòng trong 1 transaction
    return this.prisma.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          roomId: dto.roomId,
          tenantId: dto.tenantId,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          deposit: dto.deposit,
          paymentCycle: dto.paymentCycle ?? 1,
          electricityRate: dto.electricityRate ?? 3500,
          waterRate: dto.waterRate ?? 15000,
          customServices: (dto.customServices as any) || [],
          notes: dto.notes,
        },
        include: { room: true, tenant: true },
      });

      await tx.room.update({
        where: { id: dto.roomId },
        data: { status: RoomStatus.RENTED },
      });

      await tx.auditLog.create({
        data: {
          landlordId,
          action: AuditAction.CONTRACT_CREATED,
          entityType: 'Contract',
          entityId: contract.id,
          details: {
            roomId: contract.roomId,
            roomName: contract.room.name,
            tenantId: contract.tenantId,
            tenantName: contract.tenant.fullName,
          },
        },
      });

      return contract;
    });
  }

  // Lấy tất cả hợp đồng (hỗ trợ phân trang)
  async findAll(landlordId: string, propertyId?: string, onlyActive?: boolean, page?: number, limit?: number) {
    const where = {
      room: {
        landlordId,
        ...(propertyId ? { propertyId } : {})
      },
      ...(onlyActive ? { isActive: true } : {}),
    };

    const include = {
      room: true,
      tenant: true,
      roommates: true,
      invoices: { orderBy: { createdAt: 'desc' as const }, take: 3 },
    };
    const orderBy: any = { createdAt: 'desc' };

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.max(1, Number(limit) || 10);
      const skip = (pageNum - 1) * limitNum;

      const [data, total] = await Promise.all([
        this.prisma.contract.findMany({
          where,
          include,
          orderBy,
          skip,
          take: limitNum,
        }),
        this.prisma.contract.count({ where }),
      ]);

      return {
        data,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    }

    return this.prisma.contract.findMany({
      where,
      include,
      orderBy,
    });
  }

  // Lấy chi tiết một hợp đồng
  async findOne(id: string, landlordId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, room: { landlordId } },
      include: {
        room: true,
        tenant: true,
        roommates: true,
        invoices: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
        utilityReadings: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
      },
    });
    if (!contract) throw new NotFoundException(`Không tìm thấy hợp đồng ID: ${id}`);
    return contract;
  }

  // Cập nhật thông tin hợp đồng
  async findRenewalSuggestions(landlordId: string, days = 30) {
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      throw new BadRequestException(
        'Khoảng thời gian đề xuất phải từ 1 đến 90 ngày',
      );
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const throughDate = new Date(today);
    throughDate.setUTCDate(throughDate.getUTCDate() + days + 1);
    throughDate.setUTCMilliseconds(throughDate.getUTCMilliseconds() - 1);

    const contracts = await this.prisma.contract.findMany({
      where: {
        isActive: true,
        endDate: { gte: today, lte: throughDate },
        room: { landlordId },
      },
      include: {
        room: { select: { id: true, name: true, property: { select: { id: true, name: true } } } },
        tenant: { select: { id: true, fullName: true, phone: true, email: true } },
      },
      orderBy: { endDate: 'asc' },
    });

    return contracts.map((contract) => ({
      ...contract,
      daysUntilExpiration: Math.max(
        0,
        Math.round(
          (new Date(
            Date.UTC(
              contract.endDate!.getUTCFullYear(),
              contract.endDate!.getUTCMonth(),
              contract.endDate!.getUTCDate(),
            ),
          ).getTime() -
            today.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      ),
    }));
  }

  async update(id: string, dto: UpdateContractDto, landlordId: string) {
    const contract = await this.findOne(id, landlordId);
    const newEndDate = dto.endDate ? new Date(dto.endDate) : undefined;
    const endDateChanged =
      newEndDate !== undefined &&
      newEndDate.getTime() !== contract.endDate?.getTime();

    if (endDateChanged) {
      this.validateRenewal(contract, newEndDate);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.contract.update({
        where: { id },
        data: {
          ...dto,
          endDate: newEndDate,
        },
        include: { room: true, tenant: true },
      });

      if (endDateChanged) {
        await tx.auditLog.create({
          data: {
            landlordId,
            action: AuditAction.CONTRACT_RENEWED,
            entityType: 'Contract',
            entityId: contract.id,
            details: {
              roomId: contract.roomId,
              roomName: contract.room.name,
              tenantId: contract.tenantId,
              tenantName: contract.tenant.fullName,
              previousEndDate: contract.endDate,
              newEndDate,
            },
          },
        });
      }

      return updated;
    });
  }

  async renew(id: string, endDate: string, landlordId: string) {
    const contract = await this.findOne(id, landlordId);
    this.validateRenewal(contract, new Date(endDate));
    return this.update(id, { endDate }, landlordId);
  }

  private validateRenewal(
    contract: Awaited<ReturnType<ContractsService['findOne']>>,
    newEndDate: Date,
  ) {
    if (!contract.isActive) {
      throw new BadRequestException('Không thể gia hạn hợp đồng đã kết thúc');
    }
    if (!contract.endDate) {
      throw new BadRequestException(
        'Hợp đồng không thời hạn không cần gia hạn',
      );
    }
    if (Number.isNaN(newEndDate.getTime())) {
      throw new BadRequestException('Ngày kết thúc mới không hợp lệ');
    }
    if (
      newEndDate.getTime() <= contract.endDate.getTime() ||
      newEndDate.getTime() <= Date.now()
    ) {
      throw new BadRequestException(
        'Ngày kết thúc mới phải trong tương lai và sau ngày kết thúc hiện tại',
      );
    }
  }

  // Kết thúc hợp đồng + tự động đổi phòng về AVAILABLE
  async terminate(id: string, landlordId: string) {
    const contract = await this.findOne(id, landlordId);
    if (!contract.isActive) {
      throw new BadRequestException('Hợp đồng này đã kết thúc trước đó');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.contract.update({
        where: { id },
        data: { isActive: false, endDate: new Date() },
      });

      await tx.room.update({
        where: { id: contract.roomId },
        data: { status: RoomStatus.AVAILABLE },
      });

      await tx.auditLog.create({
        data: {
          landlordId,
          action: AuditAction.CONTRACT_TERMINATED,
          entityType: 'Contract',
          entityId: contract.id,
          details: {
            roomId: contract.roomId,
            roomName: contract.room.name,
            tenantId: contract.tenantId,
            tenantName: contract.tenant.fullName,
          },
        },
      });

      return updated;
    });
  }

  // Thêm người ở ghép
  async addRoommate(contractId: string, landlordId: string, dto: any) {
    const contract = await this.findOne(contractId, landlordId);
    if (!contract.isActive) throw new BadRequestException('Hợp đồng đã kết thúc');

    const existing = await this.prisma.tenant.findUnique({ where: { cccd: dto.cccd } });
    if (existing) {
      // If they exist, just link them
      return this.prisma.tenant.update({
        where: { id: existing.id },
        data: { roommateOfContractId: contractId }
      });
    }

    return this.prisma.tenant.create({
      data: {
        fullName: dto.fullName,
        cccd: dto.cccd,
        phone: dto.phone,
        email: dto.email,
        dob: dto.dob ? new Date(dto.dob) : null,
        gender: dto.gender,
        address: dto.address,
        roommateOfContractId: contractId,
        landlordId,
      }
    });
  }

  // Xóa người ở ghép
  async removeRoommate(contractId: string, tenantId: string, landlordId: string) {
    await this.findOne(contractId, landlordId);
    return this.prisma.tenant.updateMany({
      where: { id: tenantId, roommateOfContractId: contractId, landlordId },
      data: { roommateOfContractId: null }
    });
  }

  // Lấy yêu cầu thay đổi người ở ghép
  async getRoommateRequests(contractId: string, landlordId: string) {
    const contract = await this.findOne(contractId, landlordId);
    return this.prisma.maintenanceRequest.findMany({
      where: {
        roomId: contract.roomId,
        title: { startsWith: 'Yêu cầu' }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Ghi chỉ số điện/nước
  async recordUtilityReading(dto: CreateUtilityReadingDto, landlordId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: dto.contractId, room: { landlordId } },
    });
    if (!contract) throw new NotFoundException(`Không tìm thấy hợp đồng ID: ${dto.contractId}`);
    if (!contract.isActive) throw new BadRequestException('Hợp đồng đã kết thúc, không thể ghi chỉ số');

    // Validate chỉ số (cuối kỳ phải >= đầu kỳ)
    if (dto.electricityCurr < dto.electricityPrev) {
      throw new BadRequestException('Chỉ số điện cuối kỳ phải lớn hơn hoặc bằng đầu kỳ');
    }
    if (dto.waterCurr < dto.waterPrev) {
      throw new BadRequestException('Chỉ số nước cuối kỳ phải lớn hơn hoặc bằng đầu kỳ');
    }

    return this.prisma.utilityReading.upsert({
      where: {
        contractId_month_year: {
          contractId: dto.contractId,
          month: dto.month,
          year: dto.year,
        },
      },
      create: dto,
      update: {
        electricityPrev: dto.electricityPrev,
        electricityCurr: dto.electricityCurr,
        waterPrev: dto.waterPrev,
        waterCurr: dto.waterCurr,
      },
    });
  }

  // Lấy chỉ số điện nước của một hợp đồng
  getUtilityReadings(contractId: string, landlordId: string) {
    return this.prisma.utilityReading.findMany({
      where: { contractId, contract: { room: { landlordId } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }
}
