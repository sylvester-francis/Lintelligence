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