import { Processor, Process } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { CodeAnalysisService } from '../code-analysis/code-analysis.service';
import { GithubService } from '../github/github.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
@Processor('code-review')
export class CodeReviewProcessor {
  private readonly logger = new Logger(CodeReviewProcessor.name);

  constructor(
    private readonly codeAnalysisService: CodeAnalysisService,
    private readonly githubService: GithubService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Process('analyze-pull-request')
  async handleCodeReview(job: Job) {
    const { owner, repo, pullNumber, headSha, baseSha } = job.data;

    this.logger.log(`Processing code review for ${owner}/${repo}#${pullNumber}`);

    // Create a review record in the database
    const review = await this.databaseService.createReview({
      owner,
      repo,
      pullNumber,
      commitSha: headSha,
      summary: 'Processing...',
    });

    try {
      // Update status to in_progress
      await this.databaseService.updateReviewStatus(review.id, 'in_progress');

      // Get the diff from GitHub
      const diff = await this.githubService.getPullRequestDiff(owner, repo, pullNumber);

      // Analyze the code changes
      const analysis = await this.codeAnalysisService.analyzeCode(diff);

      // Save comments to database
      if (analysis.issues && analysis.issues.length > 0) {
        await this.databaseService.addReviewComments(review.id, analysis.issues);

        // Post review comments to GitHub
        await this.githubService.postReviewComments(
          owner,
          repo,
          pullNumber,
          headSha,
          analysis.issues,
        );
      }

      // Update review with final summary
      await this.databaseService.updateReviewStatus(review.id, 'completed');

      // Post overall review summary to GitHub
      await this.githubService.postReviewSummary(
        owner,
        repo,
        pullNumber,
        headSha,
        analysis.summary,
      );

      this.logger.log(`Completed code review for ${owner}/${repo}#${pullNumber}`);
    } catch (error) {
      // Mark review as failed
      await this.databaseService.updateReviewStatus(review.id, 'failed');

      this.logger.error(`Failed to process code review: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }
}