import { Controller, Post, Body, Headers, HttpCode } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('github')
  @HttpCode(200)
  async handleGithubWebhook(
    @Body() payload: any,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    return await this.webhookService.processGithubWebhook(payload, signature);
  }
}

