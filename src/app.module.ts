import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

// Import our custom modules
import { WebhookModule } from './modules/webhook/webhook.module';
import { CodeAnalysisModule } from './modules/code-analysis/code-analysis.module';
import { QueueModule } from './modules/queue/queue.module';
import { GithubModule } from './modules/github/github.module';
import { DatabaseModule } from './modules/database/database.module';

// Import entities
import { Review, ReviewComment } from './entities';

@Module({
  imports: [
    // Global configuration management
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database configuration
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'code_review_agent',
      entities: [Review, ReviewComment],
      synchronize: process.env.NODE_ENV !== 'production', // Only in development
      logging: process.env.NODE_ENV === 'development',
    }),

    // Redis/Bull Queue configuration
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    }),

    // Our custom modules
    DatabaseModule,
    WebhookModule,
    CodeAnalysisModule,
    QueueModule,
    GithubModule,
  ],
})
export class AppModule {}