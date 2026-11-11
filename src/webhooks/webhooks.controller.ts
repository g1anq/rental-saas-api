import { Controller, Post, Body, Headers } from '@nestjs/common';
import { WebhooksService } from './webhooks.service.js';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('sepay')
  async handleSepayWebhook(
    @Body() body: any,
    @Headers('Authorization') _authHeader: string
  ) {
    // In production, verify the Auth Header or API Key from SePay.
    return this.webhooksService.processSepayTransaction(body);
  }
}
