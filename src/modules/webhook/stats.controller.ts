import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { QueueService } from '../queue/queue.service';

@Controller('stats')
export class StatsController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly queueService: QueueService,
  ) {}

  @Get()
  async getStats() {
    const [reviewStats, queueStats] = await Promise.all([
      this.databaseService.getReviewStats(),
      this.queueService.getQueueStats(),
    ]);

    return {
      reviews: reviewStats,
      queue: queueStats,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'AI Code Review Agent',
    };
  }
}