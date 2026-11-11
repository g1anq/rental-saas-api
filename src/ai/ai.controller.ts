import { Controller, Post, Body, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../auth/get-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AiService } from './ai.service.js';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('landlord')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Chat với trợ lý AI' })
  async chat(@GetUser() landlord: any, @Body() body: { message: string, history?: any[] }) {
    if (!landlord) throw new UnauthorizedException();
    return this.aiService.processChat(landlord.id, body.message, body.history || []);
  }
}
