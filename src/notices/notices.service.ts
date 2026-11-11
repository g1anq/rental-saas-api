import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateNoticeDto } from './dto/create-notice.dto.js';
import { UpdateNoticeDto } from './dto/update-notice.dto.js';

@Injectable()
export class NoticesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateNoticeDto, landlordId: string) {
    return this.prisma.notice.create({
      data: {
        title: dto.title,
        content: dto.content,
        isImportant: dto.isImportant,
        roomId: dto.roomId,
        propertyId: dto.propertyId,
        landlordId,
      },
      include: {
        room: true,
        property: true,
      }
    });
  }

  findAll(landlordId: string, propertyId?: string) {
    return this.prisma.notice.findMany({
      where: {
        landlordId,
        ...(propertyId ? {
          OR: [
            { roomId: null, propertyId: null },
            { propertyId },
            { room: { propertyId } }
          ]
        } : {})
      },
      include: { room: true, property: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, landlordId: string) {
    const notice = await this.prisma.notice.findFirst({
      where: { id, landlordId },
      include: { room: true, property: true },
    });
    if (!notice) throw new NotFoundException('Không tìm thấy thông báo');
    return notice;
  }

  async update(id: string, dto: UpdateNoticeDto, landlordId: string) {
    await this.findOne(id, landlordId);
    return this.prisma.notice.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, landlordId: string) {
    await this.findOne(id, landlordId);
    return this.prisma.notice.delete({
      where: { id },
    });
  }
}
