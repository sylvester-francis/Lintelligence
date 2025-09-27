# Production-Ready Queue Processing for Code Analysis Services

## Introduction

In our previous articles, we built an event-driven architecture and integrated AI-powered code analysis. Now we'll focus on making our queue processing system production-ready, covering advanced patterns, monitoring, scaling strategies, and deployment considerations.

This article demonstrates:
- Advanced queue processing patterns and optimization
- Comprehensive monitoring and alerting strategies
- Scaling patterns for high-volume repositories
- Production deployment and DevOps best practices

## Advanced Queue Processing Patterns

### Priority-Based Processing

Not all pull requests are equal. Implement priority queues to handle critical repositories first:

```typescript
// src/modules/queue/priority-queue.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface PriorityJobData {
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
  baseSha: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

@Injectable()
export class PriorityQueueService {
  private readonly logger = new Logger(PriorityQueueService.name);

  constructor(
    @InjectQueue('code-review') private codeReviewQueue: Queue,
  ) {}

  async addPriorityJob(data: PriorityJobData): Promise<void> {
    const priorityMap = {
      low: 1,
      normal: 5,
      high: 10,
      critical: 20,
    };

    const jobOptions = {
      priority: priorityMap[data.priority],
      attempts: this.getAttemptsForPriority(data.priority),
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    };

    await this.codeReviewQueue.add('analyze-pull-request', data, jobOptions);

    this.logger.log(
      `Added ${data.priority} priority job for ${data.owner}/${data.repo}#${data.pullNumber}`
    );
  }

  private getAttemptsForPriority(priority: string): number {
    const attemptMap = {
      low: 2,
      normal: 3,
      high: 5,
      critical: 10,
    };
    return attemptMap[priority] || 3;
  }

  async getRepositoryPriority(owner: string, repo: string): Promise<string> {
    // Implement priority logic based on repository characteristics
    const criticalRepos = ['production', 'main', 'core'];
    const highPriorityRepos = ['api', 'service', 'web'];

    if (criticalRepos.some(keyword => repo.toLowerCase().includes(keyword))) {
      return 'critical';
    }

    if (highPriorityRepos.some(keyword => repo.toLowerCase().includes(keyword))) {
      return 'high';
    }

    // Check stars, activity, etc. from GitHub API
    return 'normal';
  }
}
```

### Concurrency Control and Rate Limiting

Manage processing concurrency to prevent overwhelming external APIs:

```typescript
// src/modules/queue/concurrency-manager.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class ConcurrencyManagerService {
  private readonly logger = new Logger(ConcurrencyManagerService.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
    });
  }

  async acquireLock(resource: string, ttl: number = 30000): Promise<boolean> {
    const lockKey = `lock:${resource}`;
    const lockValue = Date.now().toString();

    const result = await this.redis.set(
      lockKey,
      lockValue,
      'PX',
      ttl,
      'NX'
    );

    return result === 'OK';
  }

  async releaseLock(resource: string): Promise<void> {
    const lockKey = `lock:${resource}`;
    await this.redis.del(lockKey);
  }

  async checkRateLimit(identifier: string, limit: number, window: number): Promise<boolean> {
    const key = `rate_limit:${identifier}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, window);
    }

    return current <= limit;
  }

  async getCurrentUsage(identifier: string): Promise<number> {
    const key = `rate_limit:${identifier}`;
    const current = await this.redis.get(key);
    return parseInt(current || '0');
  }
}
```

### Enhanced Job Processor with Concurrency Control

Update the processor to use concurrency management:

```typescript
// src/modules/queue/enhanced-processor.service.ts
import { Processor, Process } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ConcurrencyManagerService } from './concurrency-manager.service';
import { MetricsService } from '../monitoring/metrics.service';

@Injectable()
@Processor('code-review')
export class EnhancedCodeReviewProcessor {
  private readonly logger = new Logger(EnhancedCodeReviewProcessor.name);

  constructor(
    private readonly concurrencyManager: ConcurrencyManagerService,
    private readonly metricsService: MetricsService,
  ) {}

  @Process({
    name: 'analyze-pull-request',
    concurrency: 5, // Process up to 5 jobs concurrently
  })
  async handleCodeReview(job: Job) {
    const startTime = Date.now();
    const { owner, repo, pullNumber } = job.data;

    // Create a unique identifier for this repository
    const repoIdentifier = `${owner}/${repo}`;

    try {
      // Check rate limits for GitHub API
      const canProceed = await this.concurrencyManager.checkRateLimit(
        `github:${owner}`,
        100, // 100 requests per hour per owner
        3600
      );

      if (!canProceed) {
        this.logger.warn(`Rate limit exceeded for ${owner}, delaying job`);
        throw new Error('Rate limit exceeded');
      }

      // Acquire lock to prevent duplicate processing
      const lockAcquired = await this.concurrencyManager.acquireLock(
        `pr:${repoIdentifier}:${pullNumber}`,
        300000 // 5 minutes
      );

      if (!lockAcquired) {
        this.logger.warn(`Job already being processed: ${repoIdentifier}#${pullNumber}`);
        return { status: 'duplicate', message: 'Job already in progress' };
      }

      // Update job progress
      await job.progress(10);

      // Process the code review
      const result = await this.processCodeReview(job);

      // Update metrics
      const duration = Date.now() - startTime;
      await this.metricsService.recordJobCompletion(duration, 'success');

      await job.progress(100);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      await this.metricsService.recordJobCompletion(duration, 'error');

      this.logger.error(
        `Failed to process code review for ${repoIdentifier}#${pullNumber}: ${error.message}`
      );
      throw error;

    } finally {
      // Always release the lock
      await this.concurrencyManager.releaseLock(
        `pr:${repoIdentifier}:${pullNumber}`
      );
    }
  }

  private async processCodeReview(job: Job): Promise<any> {
    // Implementation details from previous articles
    // This would include the actual code analysis logic
    return { status: 'completed' };
  }
}
```

## Comprehensive Monitoring and Observability

### Metrics Collection Service

Implement detailed metrics collection for monitoring system health:

```typescript
// src/modules/monitoring/metrics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobMetric } from './entities/job-metric.entity';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectRepository(JobMetric)
    private jobMetricRepository: Repository<JobMetric>,
  ) {}

  async recordJobCompletion(
    duration: number,
    status: 'success' | 'error' | 'timeout',
    metadata?: Record<string, any>
  ): Promise<void> {
    const metric = this.jobMetricRepository.create({
      duration,
      status,
      metadata,
      timestamp: new Date(),
    });

    await this.jobMetricRepository.save(metric);

    // Log for immediate visibility
    this.logger.log(`Job completed: ${status}, duration: ${duration}ms`);
  }

  async getAverageProcessingTime(hours: number = 24): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const result = await this.jobMetricRepository
      .createQueryBuilder('metric')
      .select('AVG(metric.duration)', 'avgDuration')
      .where('metric.timestamp > :since', { since })
      .andWhere('metric.status = :status', { status: 'success' })
      .getRawOne();

    return parseFloat(result.avgDuration) || 0;
  }

  async getSuccessRate(hours: number = 24): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [total, successful] = await Promise.all([
      this.jobMetricRepository.count({
        where: { timestamp: { $gte: since } }
      }),
      this.jobMetricRepository.count({
        where: {
          timestamp: { $gte: since },
          status: 'success'
        }
      })
    ]);

    return total > 0 ? (successful / total) * 100 : 0;
  }

  async getThroughput(hours: number = 1): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const count = await this.jobMetricRepository.count({
      where: { timestamp: { $gte: since } }
    });

    return count / hours;
  }
}
```

### Real-time Dashboard Service

Create a service for real-time monitoring data:

```typescript
// src/modules/monitoring/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { MetricsService } from './metrics.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectQueue('code-review') private codeReviewQueue: Queue,
    private readonly metricsService: MetricsService,
    private readonly databaseService: DatabaseService,
  ) {}

  async getSystemHealth(): Promise<any> {
    const [
      queueStats,
      avgProcessingTime,
      successRate,
      throughput,
      reviewStats
    ] = await Promise.all([
      this.getQueueStatistics(),
      this.metricsService.getAverageProcessingTime(),
      this.metricsService.getSuccessRate(),
      this.metricsService.getThroughput(),
      this.databaseService.getReviewStats()
    ]);

    return {
      timestamp: new Date().toISOString(),
      queue: queueStats,
      performance: {
        avgProcessingTime: Math.round(avgProcessingTime),
        successRate: Math.round(successRate * 100) / 100,
        throughput: Math.round(throughput * 100) / 100,
      },
      reviews: reviewStats,
      health: this.calculateHealthScore(successRate, avgProcessingTime, queueStats),
    };
  }

  private async getQueueStatistics(): Promise<any> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.codeReviewQueue.getWaiting(),
      this.codeReviewQueue.getActive(),
      this.codeReviewQueue.getCompleted(),
      this.codeReviewQueue.getFailed(),
      this.codeReviewQueue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      total: waiting.length + active.length + completed.length + failed.length,
    };
  }

  private calculateHealthScore(
    successRate: number,
    avgProcessingTime: number,
    queueStats: any
  ): 'healthy' | 'warning' | 'critical' {
    // Define health thresholds
    if (successRate < 80 || avgProcessingTime > 300000 || queueStats.waiting > 100) {
      return 'critical';
    }

    if (successRate < 95 || avgProcessingTime > 120000 || queueStats.waiting > 50) {
      return 'warning';
    }

    return 'healthy';
  }
}
```

### Alerting System

Implement proactive alerting for system issues:

```typescript
// src/modules/monitoring/alerting.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DashboardService } from './dashboard.service';

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkSystemHealth(): Promise<void> {
    try {
      const health = await this.dashboardService.getSystemHealth();

      if (health.health === 'critical') {
        await this.sendCriticalAlert(health);
      } else if (health.health === 'warning') {
        await this.sendWarningAlert(health);
      }

      // Check specific thresholds
      await this.checkSpecificThresholds(health);

    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      await this.sendSystemAlert('Health check failure', error.message);
    }
  }

  private async checkSpecificThresholds(health: any): Promise<void> {
    // Queue depth alert
    if (health.queue.waiting > 200) {
      await this.sendAlert(
        'High queue depth',
        `Queue has ${health.queue.waiting} waiting jobs`,
        'warning'
      );
    }

    // Processing time alert
    if (health.performance.avgProcessingTime > 300000) {
      await this.sendAlert(
        'Slow processing',
        `Average processing time: ${health.performance.avgProcessingTime}ms`,
        'warning'
      );
    }

    // Success rate alert
    if (health.performance.successRate < 90) {
      await this.sendAlert(
        'Low success rate',
        `Success rate: ${health.performance.successRate}%`,
        'critical'
      );
    }
  }

  private async sendCriticalAlert(health: any): Promise<void> {
    await this.sendAlert(
      'System Critical',
      `System health is critical. Success rate: ${health.performance.successRate}%, Queue: ${health.queue.waiting} waiting`,
      'critical'
    );
  }

  private async sendWarningAlert(health: any): Promise<void> {
    await this.sendAlert(
      'System Warning',
      `System performance degraded. Success rate: ${health.performance.successRate}%, Queue: ${health.queue.waiting} waiting`,
      'warning'
    );
  }

  private async sendAlert(
    title: string,
    message: string,
    severity: 'info' | 'warning' | 'critical'
  ): Promise<void> {
    this.logger.warn(`ALERT [${severity.toUpperCase()}]: ${title} - ${message}`);

    // Implement your preferred alerting mechanism:
    // - Email notifications
    // - Slack webhooks
    // - PagerDuty
    // - Discord webhooks
    // - etc.

    await this.sendSlackAlert(title, message, severity);
  }

  private async sendSlackAlert(
    title: string,
    message: string,
    severity: string
  ): Promise<void> {
    // Implement Slack webhook notification
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;

    const color = {
      info: '#36a64f',
      warning: '#ff9500',
      critical: '#ff0000',
    }[severity];

    const payload = {
      attachments: [
        {
          color,
          title: `Code Review Agent Alert: ${title}`,
          text: message,
          timestamp: Math.floor(Date.now() / 1000),
        },
      ],
    };

    // Send to Slack (implement HTTP request)
  }

  private async sendSystemAlert(title: string, message: string): Promise<void> {
    await this.sendAlert(title, message, 'critical');
  }
}
```

## Scaling Strategies

### Horizontal Scaling with Multiple Workers

Configure multiple worker processes for increased throughput:

```typescript
// src/modules/scaling/worker-manager.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as os from 'os';

@Injectable()
export class WorkerManagerService {
  private readonly logger = new Logger(WorkerManagerService.name);

  constructor(
    @InjectQueue('code-review') private codeReviewQueue: Queue,
  ) {}

  async configureWorkers(): Promise<void> {
    const cpuCount = os.cpus().length;
    const optimalWorkers = Math.min(cpuCount, 8); // Cap at 8 workers

    this.logger.log(`Configuring ${optimalWorkers} workers for ${cpuCount} CPUs`);

    // Configure queue with optimal concurrency
    await this.codeReviewQueue.process(
      'analyze-pull-request',
      optimalWorkers,
      async (job) => {
        // This is handled by our processor
        return await this.processJob(job);
      }
    );
  }

  private async processJob(job: any): Promise<any> {
    // Job processing logic
    return { status: 'completed' };
  }

  async getWorkerStats(): Promise<any> {
    const workers = await this.codeReviewQueue.getWorkers();
    const activeJobs = await this.codeReviewQueue.getActive();

    return {
      totalWorkers: workers.length,
      activeJobs: activeJobs.length,
      cpuUsage: process.cpuUsage(),
      memoryUsage: process.memoryUsage(),
    };
  }
}
```

### Auto-scaling Based on Queue Depth

Implement intelligent scaling based on queue metrics:

```typescript
// src/modules/scaling/auto-scaler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DashboardService } from '../monitoring/dashboard.service';

@Injectable()
export class AutoScalerService {
  private readonly logger = new Logger(AutoScalerService.name);
  private currentWorkers = 1;
  private readonly maxWorkers = 10;
  private readonly minWorkers = 1;

  constructor(private readonly dashboardService: DashboardService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async evaluateScaling(): Promise<void> {
    try {
      const health = await this.dashboardService.getSystemHealth();
      const queueDepth = health.queue.waiting;
      const avgProcessingTime = health.performance.avgProcessingTime;

      const recommendedWorkers = this.calculateOptimalWorkers(
        queueDepth,
        avgProcessingTime
      );

      if (recommendedWorkers !== this.currentWorkers) {
        await this.scaleWorkers(recommendedWorkers);
      }

    } catch (error) {
      this.logger.error(`Auto-scaling evaluation failed: ${error.message}`);
    }
  }

  private calculateOptimalWorkers(
    queueDepth: number,
    avgProcessingTime: number
  ): number {
    // Scale up if queue is growing
    if (queueDepth > 50) {
      return Math.min(this.currentWorkers + 2, this.maxWorkers);
    }

    // Scale up if processing is slow
    if (avgProcessingTime > 180000 && queueDepth > 10) { // 3 minutes
      return Math.min(this.currentWorkers + 1, this.maxWorkers);
    }

    // Scale down if queue is empty and we have excess workers
    if (queueDepth === 0 && this.currentWorkers > this.minWorkers) {
      return Math.max(this.currentWorkers - 1, this.minWorkers);
    }

    return this.currentWorkers;
  }

  private async scaleWorkers(targetWorkers: number): Promise<void> {
    this.logger.log(`Scaling from ${this.currentWorkers} to ${targetWorkers} workers`);

    // In a container environment, this would trigger pod scaling
    // For now, we'll just log the scaling decision
    this.currentWorkers = targetWorkers;

    // In production, implement actual scaling:
    // - Kubernetes HPA
    // - Docker Swarm scaling
    // - AWS ECS/Fargate scaling
    // - etc.
  }
}
```

## Production Deployment

### Docker Production Configuration

Create optimized production Docker configuration:

```dockerfile
# Dockerfile.production
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY src/ src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs package*.json ./

# Create logs directory
RUN mkdir -p /app/logs && chown nestjs:nodejs /app/logs

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/stats/health || exit 1

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

### Kubernetes Deployment

Deploy with Kubernetes for production scalability:

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: code-review-agent
  labels:
    app: code-review-agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: code-review-agent
  template:
    metadata:
      labels:
        app: code-review-agent
    spec:
      containers:
      - name: code-review-agent
        image: your-registry/code-review-agent:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: database-secrets
              key: host
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: openai-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /stats/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /stats/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: code-review-agent-service
spec:
  selector:
    app: code-review-agent
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: code-review-agent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: code-review-agent
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Environment-Specific Configuration

Manage different environments with proper configuration:

```typescript
// src/config/production.config.ts
export const productionConfig = {
  queue: {
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
    settings: {
      stalledInterval: 30000,
      maxStalledCount: 1,
    },
  },
  monitoring: {
    healthCheckInterval: 60000,
    metricsRetentionDays: 30,
  },
  scaling: {
    minWorkers: 2,
    maxWorkers: 20,
    scaleUpThreshold: 50,
    scaleDownThreshold: 5,
  },
  rateLimit: {
    githubApiLimit: 5000, // per hour
    openaiApiLimit: 1000,  // per hour
  },
};
```

## Performance Optimization

### Queue Optimization

Optimize queue performance for high throughput:

```typescript
// src/modules/optimization/queue-optimizer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class QueueOptimizerService {
  private readonly logger = new Logger(QueueOptimizerService.name);

  constructor(
    @InjectQueue('code-review') private codeReviewQueue: Queue,
  ) {}

  async optimizeQueue(): Promise<void> {
    // Configure queue settings for optimal performance
    await this.codeReviewQueue.isReady();

    // Set up event listeners for monitoring
    this.setupQueueEventListeners();

    // Configure queue processing options
    this.configureProcessingOptions();

    this.logger.log('Queue optimization completed');
  }

  private setupQueueEventListeners(): void {
    this.codeReviewQueue.on('completed', (job, result) => {
      this.logger.debug(`Job ${job.id} completed successfully`);
    });

    this.codeReviewQueue.on('failed', (job, err) => {
      this.logger.error(`Job ${job.id} failed: ${err.message}`);
    });

    this.codeReviewQueue.on('stalled', (job) => {
      this.logger.warn(`Job ${job.id} stalled and will be retried`);
    });

    this.codeReviewQueue.on('progress', (job, progress) => {
      this.logger.debug(`Job ${job.id} progress: ${progress}%`);
    });
  }

  private configureProcessingOptions(): void {
    // Configure Redis connection for optimal performance
    const redis = this.codeReviewQueue.client;

    // Set Redis pipeline for batch operations
    redis.pipeline()
      .config('set', 'tcp-keepalive', '60')
      .config('set', 'timeout', '0')
      .exec();
  }

  async cleanupOldJobs(): Promise<void> {
    // Clean up completed jobs older than 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    await this.codeReviewQueue.clean(oneDayAgo, 'completed');
    await this.codeReviewQueue.clean(oneDayAgo, 'failed');

    this.logger.log('Cleaned up old jobs');
  }
}
```

### Memory Management

Implement efficient memory usage patterns:

```typescript
// src/modules/optimization/memory-manager.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class MemoryManagerService {
  private readonly logger = new Logger(MemoryManagerService.name);

  @Cron(CronExpression.EVERY_5_MINUTES)
  checkMemoryUsage(): void {
    const usage = process.memoryUsage();
    const usageInMB = {
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100,
    };

    this.logger.debug(`Memory usage: ${JSON.stringify(usageInMB)} MB`);

    // Alert if memory usage is high
    if (usageInMB.heapUsed > 512) { // 512 MB threshold
      this.logger.warn(`High memory usage detected: ${usageInMB.heapUsed} MB`);
    }

    // Force garbage collection if memory usage is critical
    if (usageInMB.heapUsed > 800) { // 800 MB threshold
      if (global.gc) {
        global.gc();
        this.logger.log('Forced garbage collection');
      }
    }
  }

  getMemoryStats(): any {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      heapUsedPercentage: (usage.heapUsed / usage.heapTotal) * 100,
    };
  }
}
```

## Security Best Practices

### Enhanced Security Configuration

Implement comprehensive security measures:

```typescript
// src/modules/security/security.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as helmet from 'helmet';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  validateWebhookSignature(payload: string, signature: string): boolean {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.warn('No webhook secret configured');
      return false;
    }

    const hmac = crypto.createHmac('sha256', secret);
    const expectedSignature = 'sha256=' + hmac.update(payload).digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  sanitizeUserInput(input: string): string {
    // Remove potentially dangerous characters
    return input.replace(/[<>\"'&]/g, '');
  }

  encryptSensitiveData(data: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default', 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAAD(Buffer.from('additional data'));

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  configureSecurityMiddleware(): any {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    });
  }
}
```

## Testing Production Systems

### Load Testing

Implement comprehensive load testing:

```typescript
// test/load/load-test.spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Load Testing', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('should handle concurrent webhook requests', async () => {
    const concurrentRequests = 50;
    const requests = Array(concurrentRequests).fill(0).map(() =>
      request(app.getHttpServer())
        .post('/webhook/github')
        .send({
          action: 'opened',
          pull_request: { number: Math.floor(Math.random() * 1000) },
          repository: { name: 'test', owner: { login: 'user' } },
        })
        .expect(200)
    );

    const results = await Promise.allSettled(requests);
    const successful = results.filter(result => result.status === 'fulfilled').length;

    expect(successful).toBeGreaterThan(concurrentRequests * 0.95); // 95% success rate
  });

  it('should maintain performance under sustained load', async () => {
    const duration = 30000; // 30 seconds
    const startTime = Date.now();
    const results = [];

    while (Date.now() - startTime < duration) {
      const start = Date.now();

      await request(app.getHttpServer())
        .get('/stats/health')
        .expect(200);

      const responseTime = Date.now() - start;
      results.push(responseTime);

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const avgResponseTime = results.reduce((a, b) => a + b, 0) / results.length;
    expect(avgResponseTime).toBeLessThan(100); // Average response time under 100ms
  });
});
```

## Conclusion

We've built a production-ready queue processing system that can handle high-volume code review workloads with:

**Advanced Queue Management:**
- Priority-based job processing
- Concurrency control and rate limiting
- Intelligent auto-scaling capabilities

**Comprehensive Monitoring:**
- Real-time metrics collection and analysis
- Health monitoring with automated alerting
- Performance tracking and optimization

**Production Deployment:**
- Containerized deployment with Kubernetes
- Horizontal pod autoscaling
- Security best practices implementation

**Performance Optimization:**
- Memory management and garbage collection
- Queue optimization for high throughput
- Load testing and performance validation

**Key Achievements:**
- **Scalable Architecture**: Handles variable workloads efficiently
- **Robust Monitoring**: Proactive issue detection and alerting
- **Production Security**: Comprehensive security measures
- **High Availability**: Fault-tolerant design with auto-recovery
- **Performance Optimized**: Tuned for high-throughput processing

## Series Summary

Across these three articles, we've built a complete intelligent code review system:

1. **Event-Driven Foundation**: Secure webhook handling, queue-based processing, and modular architecture
2. **AI Integration**: OpenAI-powered code analysis with fallback mechanisms and GitHub integration
3. **Production Readiness**: Monitoring, scaling, security, and deployment strategies

This system demonstrates real-world patterns for building scalable, reliable AI-powered services that can handle production workloads while maintaining code quality and developer productivity.

---

**Complete Project Resources:**
- [GitHub Repository](https://github.com/your-username/intelligent-code-review-agent)
- [Docker Images](https://hub.docker.com/r/your-username/code-review-agent)
- [Kubernetes Manifests](https://github.com/your-username/intelligent-code-review-agent/tree/main/k8s)
- [Monitoring Dashboard](https://github.com/your-username/intelligent-code-review-agent/tree/main/monitoring)