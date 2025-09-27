import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { StatsController } from './stats.controller';
import { QueueModule } from '../queue/queue.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [QueueModule, DatabaseModule],
  controllers: [WebhookController, StatsController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}