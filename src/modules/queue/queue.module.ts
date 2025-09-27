import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';
import { CodeReviewProcessor } from './code-review.processor';
import { CodeAnalysisModule } from '../code-analysis/code-analysis.module';
import { GithubModule } from '../github/github.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'code-review',
    }),
    CodeAnalysisModule,
    GithubModule,
    DatabaseModule,
  ],
  providers: [QueueService, CodeReviewProcessor],
  exports: [QueueService, BullModule],
})
export class QueueModule {}