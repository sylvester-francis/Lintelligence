# Building Event-Driven Architecture with NestJS and TypeScript

## Introduction

Event-driven architecture has become a cornerstone of modern software development, enabling applications to respond to real-time events and scale efficiently. In this comprehensive guide, we'll build an intelligent code review agent that demonstrates core event-driven patterns using NestJS and TypeScript.

By the end of this tutorial, you'll understand how to:
- Design event-driven systems with proper separation of concerns
- Handle GitHub webhooks securely and efficiently
- Implement asynchronous processing with queues
- Structure a scalable NestJS application

## What We're Building

Our intelligent code review agent will:
- Receive GitHub webhook events when pull requests are created or updated
- Process code changes asynchronously using AI analysis
- Post structured feedback directly to GitHub pull requests
- Store review history for analytics and improvement

## Core Architecture Principles

### Event-Driven Flow

```
GitHub Event → Webhook → Validation → Queue → Processing → Response
```

This flow ensures:
- **Loose coupling**: Components don't directly depend on each other
- **Scalability**: Each step can be scaled independently
- **Reliability**: Failed operations can be retried
- **Observability**: Each step can be monitored and logged

### Module Structure

Our NestJS application follows a modular approach:

```
src/
├── modules/
│   ├── webhook/        # HTTP event reception
│   ├── queue/          # Async job processing
│   ├── code-analysis/  # Business logic
│   ├── github/         # External API integration
│   └── database/       # Data persistence
```

## Setting Up the Foundation

### Project Initialization

First, let's create our NestJS project with the necessary dependencies:

```bash
npm i -g @nestjs/cli
nest new intelligent-code-review-agent
cd intelligent-code-review-agent

# Core dependencies
npm install @nestjs/config @nestjs/typeorm @nestjs/bull
npm install bull redis pg typeorm
npm install @octokit/rest openai

# Development dependencies
npm install -D @types/bull @types/pg
```

### Environment Configuration

Create a robust configuration system that handles multiple environments:

```typescript
// src/common/config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },
  github: {
    token: process.env.GITHUB_TOKEN,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
});
```

## Implementing the Webhook Module

### Webhook Controller

The webhook controller is our entry point for GitHub events. It must handle high traffic and validate requests securely:

```typescript
// src/modules/webhook/webhook.controller.ts
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
```

### Webhook Service with Signature Validation

Security is critical when handling webhooks. Always validate the signature:

```typescript
// src/modules/webhook/webhook.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as crypto from 'crypto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectQueue('code-review') private codeReviewQueue: Queue,
  ) {}

  async processGithubWebhook(payload: any, signature: string): Promise<any> {
    this.logger.log(`Processing GitHub webhook: ${payload.action}`);

    // Verify webhook signature
    if (!this.verifySignature(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    // Handle pull request events
    if (payload.action === 'opened' || payload.action === 'synchronize') {
      await this.handlePullRequestEvent(payload);
    }

    return { message: 'Webhook processed successfully' };
  }

  private verifySignature(payload: any, signature: string): boolean {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.warn('No webhook secret configured');
      return true; // Skip verification in development
    }

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  private async handlePullRequestEvent(payload: any): Promise<void> {
    const pullRequest = payload.pull_request;

    // Add job to queue for processing
    await this.codeReviewQueue.add('analyze-pull-request', {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      pullNumber: pullRequest.number,
      headSha: pullRequest.head.sha,
      baseSha: pullRequest.base.sha,
    });

    this.logger.log(`Queued code review for PR #${pullRequest.number}`);
  }
}
```

## Queue-Based Processing

### Why Queues Matter

Queues provide several benefits for event-driven systems:

1. **Decoupling**: Webhook handling is separated from processing
2. **Reliability**: Failed jobs can be retried automatically
3. **Scalability**: Multiple workers can process jobs in parallel
4. **Observability**: Queue metrics help monitor system health

### Queue Module Setup

```typescript
// src/modules/queue/queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';
import { CodeReviewProcessor } from './code-review.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'code-review',
    }),
  ],
  providers: [QueueService, CodeReviewProcessor],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
```

### Job Processor Implementation

The processor handles the actual business logic asynchronously:

```typescript
// src/modules/queue/code-review.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';

@Injectable()
@Processor('code-review')
export class CodeReviewProcessor {
  private readonly logger = new Logger(CodeReviewProcessor.name);

  @Process('analyze-pull-request')
  async handleCodeReview(job: Job) {
    const { owner, repo, pullNumber, headSha } = job.data;

    this.logger.log(`Processing code review for ${owner}/${repo}#${pullNumber}`);

    try {
      // Business logic will be implemented in subsequent articles
      await this.performCodeAnalysis(job.data);

      this.logger.log(`Completed code review for ${owner}/${repo}#${pullNumber}`);
    } catch (error) {
      this.logger.error(`Failed to process code review: ${error.message}`);
      throw error;
    }
  }

  private async performCodeAnalysis(data: any): Promise<void> {
    // Placeholder for code analysis logic
    // This will be expanded in the next article
  }
}
```

## Application Module Integration

### Main Application Module

Bring all modules together with proper dependency injection:

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import configuration from './common/config/configuration';

// Import our custom modules
import { WebhookModule } from './modules/webhook/webhook.module';
import { QueueModule } from './modules/queue/queue.module';

@Module({
  imports: [
    // Global configuration management
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Database configuration
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'code_review_agent',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
    }),

    // Redis/Bull Queue configuration
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379'),
      },
    }),

    // Feature modules
    WebhookModule,
    QueueModule,
  ],
})
export class AppModule {}
```

## Error Handling and Monitoring

### Comprehensive Error Handling

Implement proper error handling throughout the event flow:

```typescript
// src/common/filters/http-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    response
      .status(status)
      .json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: exception.message,
      });
  }
}
```

### Queue Monitoring

Monitor queue health with a stats endpoint:

```typescript
// src/modules/webhook/stats.controller.ts
import { Controller, Get } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly queueService: QueueService) {}

  @Get()
  async getStats() {
    const queueStats = await this.queueService.getQueueStats();

    return {
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
```

## Testing Event-Driven Systems

### Unit Testing Controllers

Test webhook handling with proper mocking:

```typescript
// src/modules/webhook/webhook.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

describe('WebhookController', () => {
  let controller: WebhookController;
  let service: WebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: WebhookService,
          useValue: {
            processGithubWebhook: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    service = module.get<WebhookService>(WebhookService);
  });

  it('should process webhook events', async () => {
    const payload = { action: 'opened', pull_request: { number: 1 } };
    const signature = 'sha256=test';

    jest.spyOn(service, 'processGithubWebhook').mockResolvedValue({ message: 'success' });

    const result = await controller.handleGithubWebhook(payload, signature);

    expect(service.processGithubWebhook).toHaveBeenCalledWith(payload, signature);
    expect(result).toEqual({ message: 'success' });
  });
});
```

### Integration Testing

Test the complete event flow:

```typescript
// test/webhook.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Webhook (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/webhook/github (POST)', () => {
    return request(app.getHttpServer())
      .post('/webhook/github')
      .send({
        action: 'opened',
        pull_request: { number: 1 },
        repository: { name: 'test', owner: { login: 'user' } },
      })
      .expect(200);
  });
});
```

## Deployment Considerations

### Docker Configuration

Containerize the application for consistent deployments:

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS production

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Docker Compose for Development

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: code_review_agent
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## Best Practices and Lessons Learned

### 1. Webhook Security
- Always validate webhook signatures
- Use HTTPS in production
- Implement rate limiting
- Log security events

### 2. Queue Management
- Set appropriate retry policies
- Monitor queue depth and processing times
- Implement dead letter queues for failed jobs
- Use queue priorities for critical events

### 3. Error Handling
- Fail fast for invalid requests
- Retry transient failures
- Log with correlation IDs
- Implement circuit breakers for external services

### 4. Monitoring and Observability
- Track webhook processing times
- Monitor queue health metrics
- Set up alerts for failed jobs
- Use structured logging

## Conclusion

We've built a solid foundation for an event-driven code review system using NestJS and TypeScript. Key achievements:

- **Modular Architecture**: Clear separation of concerns with focused modules
- **Secure Webhook Handling**: Proper signature validation and error handling
- **Asynchronous Processing**: Queue-based job processing for scalability
- **Type Safety**: Full TypeScript integration with proper interfaces
- **Testing Strategy**: Unit and integration tests for reliability

In the next article, we'll add AI-powered code analysis capabilities, showing how to integrate OpenAI's API for intelligent code review and implement sophisticated prompt engineering techniques.

## What's Next

The next article will cover:
- Integrating OpenAI's API for code analysis
- Designing effective prompts for different types of code review
- Implementing fallback strategies for AI service failures
- Adding GitHub API integration for posting review comments

Stay tuned for "AI-Powered Code Review: Integrating LLMs with GitHub Webhooks"!

---

**Resources:**
- [Complete source code](https://github.com/your-username/intelligent-code-review-agent)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [GitHub Webhooks Guide](https://docs.github.com/en/developers/webhooks-and-events)