import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  create(createPropertyDto: CreatePropertyDto, landlordId: string) {
    return this.prisma.property.create({
      data: {
        ...createPropertyDto,
        landlordId,
      },
    });
  }

  findAll(landlordId: string) {
    return this.prisma.property.findMany({
      where: { landlordId },
      include: {
        _count: {
          select: { rooms: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, landlordId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, landlordId },
      include: { rooms: true },
    });
    if (!property) throw new NotFoundException('Không tìm thấy khu trọ');
    return property;
  }

  async update(id: string, updatePropertyDto: UpdatePropertyDto, landlordId: string) {
    await this.findOne(id, landlordId);
    return this.prisma.property.update({
      where: { id },
      data: updatePropertyDto,
    });
  }

  async remove(id: string, landlordId: string) {
    await this.findOne(id, landlordId);
    return this.prisma.property.delete({
      where: { id },
    });
  }
}
