import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleGenAI, Type } from '@google/genai';

@Injectable()
export class AiService {
  private ai: GoogleGenAI;

  constructor(private prisma: PrismaService) {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is not set in .env!");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy' });
  }

  async processChat(landlordId: string, message: string, history: any[] = []) {
    if (!process.env.GEMINI_API_KEY) {
      throw new InternalServerErrorException("GEMINI_API_KEY chưa được cấu hình trên server.");
    }

    const systemInstruction = `Bạn là trợ lý ảo AI thông minh dành riêng cho chủ nhà trọ trên nền tảng Rental SaaS.
Bạn có thể giúp chủ trọ thực hiện các thao tác quản lý nhanh chóng và trả lời các câu hỏi thống kê.
- Nếu yêu cầu tạo phòng, gọi 'createRoom'.
- Nếu hỏi về số lượng phòng nợ tiền/hóa đơn chưa thanh toán, gọi 'getUnpaidInvoicesCount'.
- Nếu hỏi về doanh thu, gọi 'getRevenue'.
Hãy trả lời ngắn gọn, thân thiện và chuyên nghiệp bằng tiếng Việt.`;

    const createRoomDeclaration = {
      name: 'createRoom',
      description: 'Tạo một phòng trọ mới trong hệ thống.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: 'Tên hoặc số phòng (VD: 105, 201, Phòng A1)',
          },
          price: {
            type: Type.NUMBER,
            description: 'Giá thuê phòng mỗi tháng (VD: 3000000)',
          },
          assets: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Danh sách các tài sản có sẵn trong phòng (VD: ["giường", "tủ"])',
          },
        },
        required: ['name', 'price'],
      },
    };

    const getUnpaidInvoicesCountDeclaration = {
      name: 'getUnpaidInvoicesCount',
      description: 'Lấy số lượng hóa đơn chưa thanh toán (phòng nợ tiền) trong một tháng/năm. Nếu không truyền sẽ lấy tháng hiện tại.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          month: { type: Type.NUMBER, description: 'Tháng (1-12)' },
          year: { type: Type.NUMBER, description: 'Năm (VD: 2026)' },
        },
      },
    };

    const getRevenueDeclaration = {
      name: 'getRevenue',
      description: 'Tính tổng doanh thu (các hóa đơn ĐÃ THANH TOÁN) của một khu nhà (hoặc toàn bộ) trong tháng/năm.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          propertyName: { type: Type.STRING, description: 'Tên khu nhà (VD: Khu A)' },
          month: { type: Type.NUMBER, description: 'Tháng (1-12)' },
          year: { type: Type.NUMBER, description: 'Năm (VD: 2026)' },
        },
      },
    };

    // Format history for Gemini
    const contents = history.map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }],
    }));

    contents.push({ role: 'user', parts: [{ text: message }] });

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: [createRoomDeclaration, getUnpaidInvoicesCountDeclaration, getRevenueDeclaration] }],
          temperature: 0.2,
        }
      });

      // Check if model wants to call a tool
      if (response.functionCalls && response.functionCalls.length > 0) {
        const call = response.functionCalls[0];
        if (call.name === 'createRoom') {
          const args = call.args as any;

          // First, we need to know which property this room belongs to.
          // Since the user didn't specify property, we find the first property of the landlord.
          // In a real app, you might ask the user or pass context.
          let propertyId = null;
          const firstProperty = await this.prisma.property.findFirst({
            where: { landlordId }
          });

          if (firstProperty) {
            propertyId = firstProperty.id;
          }

          const assetsData = args.assets ? args.assets.map((a: string) => ({
            name: a,
            quantity: 1,
            status: "Tốt"
          })) : [];

          // Execute tool
          const newRoom = await this.prisma.room.create({
            data: {
              name: args.name,
              price: args.price,
              status: 'AVAILABLE',
              propertyId,
              landlordId,
              assets: assetsData,
            }
          });

          // Return tool result to model to get final natural response
          const followUpRes = await this.ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              ...contents,
              response.candidates![0].content as any,
              {
                role: 'user',
                parts: [{
                  functionResponse: {
                    name: 'createRoom',
                    response: { success: true, room: newRoom }
                  }
                }]
              }
            ],
            config: {
              systemInstruction,
            }
          });

            return {
              reply: followUpRes.text,
              action: 'room_created',
              data: newRoom
            };
        } else if (call.name === 'getUnpaidInvoicesCount' || call.name === 'getRevenue') {
          const args = call.args as any;
          const currentDate = new Date();
          const month = args.month || (currentDate.getMonth() + 1);
          const year = args.year || currentDate.getFullYear();
          let toolResult = {};

          if (call.name === 'getUnpaidInvoicesCount') {
            const count = await this.prisma.invoice.count({
              where: {
                contract: { room: { property: { landlordId } } },
                status: 'UNPAID',
                month,
                year,
              }
            });
            toolResult = { count, month, year, status: 'UNPAID' };
          } else if (call.name === 'getRevenue') {
            const whereClause: any = {
              contract: { room: { property: { landlordId } } },
              status: 'PAID',
              month,
              year,
            };
            if (args.propertyName) {
              whereClause.contract.room.property.name = { contains: args.propertyName, mode: 'insensitive' };
            }
            const invoices = await this.prisma.invoice.findMany({ where: whereClause });
            const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
            toolResult = { totalRevenue, month, year, propertyName: args.propertyName || 'Tất cả' };
          }

          const followUpRes = await this.ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              ...contents,
              response.candidates![0].content as any,
              {
                role: 'user',
                parts: [{
                  functionResponse: {
                    name: call.name,
                    response: toolResult
                  }
                }]
              }
            ],
            config: { systemInstruction }
          });

          return { reply: followUpRes.text, action: 'data_query' };
        }
      }

      return {
        reply: response.text,
        action: 'none'
      };

    } catch (error) {
      console.error('AI Error:', error);
      throw new InternalServerErrorException('Lỗi khi gọi AI');
    }
  }
}
