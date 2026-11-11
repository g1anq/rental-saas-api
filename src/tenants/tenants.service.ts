import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTenantDto } from './dto/create-tenant.dto.js';
import { UpdateTenantDto } from './dto/update-tenant.dto.js';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  // Tạo khách thuê mới
  async create(dto: CreateTenantDto, landlordId: string) {
    // Kiểm tra CCCD trùng
    const existing = await this.prisma.tenant.findUnique({ where: { cccd: dto.cccd } });
    if (existing) {
      throw new ConflictException(`Khách thuê với CCCD ${dto.cccd} đã tồn tại`);
    }
    if (dto.roommateOfContractId) {
      await this.assertContractOwnership(dto.roommateOfContractId, landlordId);
    }
    const { dob, landlordId: _ignoredLandlordId, ...tenantData } = dto;
    return this.prisma.tenant.create({
      data: {
        ...tenantData,
        landlordId,
        ...(dob && { dob: new Date(dob) })
      }
    });
  }

  // Lấy danh sách tất cả khách thuê (kèm hợp đồng, hỗ trợ phân trang)
  async findAll(landlordId: string, propertyId?: string, page?: number, limit?: number) {
    const where = {
      landlordId,
      ...(propertyId ? {
        OR: [
          {
            contracts: {
              some: {
                room: {
                  propertyId
                }
              }
            }
          },
          {
            roommateOfContract: {
              room: {
                propertyId
              }
            }
          }
        ]
      } : {})
    };

    const include = {
      contracts: {
        include: { room: true },
        where: { isActive: true },
      },
      roommateOfContract: {
        include: { room: true },
      }
    };
    const orderBy: any = { createdAt: 'desc' };

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.max(1, Number(limit) || 10);
      const skip = (pageNum - 1) * limitNum;

      const [data, total] = await Promise.all([
        this.prisma.tenant.findMany({
          where,
          include,
          orderBy,
          skip,
          take: limitNum,
        }),
        this.prisma.tenant.count({ where }),
      ]);

      return {
        data,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    }

    return this.prisma.tenant.findMany({
      where,
      include,
      orderBy,
    });
  }

  // Lấy chi tiết một khách thuê
  async findOne(id: string, landlordId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, landlordId },
      include: {
        contracts: {
          include: {
            room: true,
            invoices: { orderBy: { createdAt: 'desc' }, take: 5 },
          },
        },
        roommateOfContract: {
          include: {
            room: true,
          }
        }
      },
    });
    if (!tenant) throw new NotFoundException(`Không tìm thấy khách thuê ID: ${id}`);
    return tenant;
  }

  // Cập nhật thông tin khách thuê
  async update(id: string, landlordId: string, dto: UpdateTenantDto) {
    await this.findOne(id, landlordId);
    if (dto.roommateOfContractId) {
      await this.assertContractOwnership(dto.roommateOfContractId, landlordId);
    }
    const { dob, landlordId: _ignoredLandlordId, ...rest } = dto;
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...rest,
        ...(dob && { dob: new Date(dob) })
      }
    });
  }

  // Xóa khách thuê (chỉ xóa nếu không có hợp đồng đang active)
  async remove(id: string, landlordId: string) {
    const tenant = await this.findOne(id, landlordId);
    const activeContracts = tenant.contracts.filter((c) => c.isActive);
    if (activeContracts.length > 0) {
      throw new ConflictException('Không thể xóa khách thuê đang có hợp đồng hiệu lực');
    }
    return this.prisma.tenant.delete({ where: { id } });
  }

  private async assertContractOwnership(contractId: string, landlordId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        id: contractId,
        room: { landlordId },
      },
    });
    if (!contract) {
      throw new NotFoundException('Không tìm thấy hợp đồng');
    }
  }
}
