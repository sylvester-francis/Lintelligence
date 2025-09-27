import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('code-review') private codeReviewQueue: Queue,
  ) {}

  async addCodeReviewJob(data: {
    owner: string;
    repo: string;
    pullNumber: number;
    headSha: string;
    baseSha: string;
  }): Promise<void> {
    await this.codeReviewQueue.add('analyze-pull-request', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    this.logger.log(`Added code review job for ${data.owner}/${data.repo}#${data.pullNumber}`);
  }

  async getQueueStats(): Promise<any> {
    const waiting = await this.codeReviewQueue.getWaiting();
    const active = await this.codeReviewQueue.getActive();
    const completed = await this.codeReviewQueue.getCompleted();
    const failed = await this.codeReviewQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }
}