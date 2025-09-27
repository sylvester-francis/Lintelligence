import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review, ReviewComment } from '../../entities';
import { CodeIssue } from '../code-analysis/code-analysis.service';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(ReviewComment)
    private commentRepository: Repository<ReviewComment>,
  ) {}

  async createReview(data: {
    owner: string;
    repo: string;
    pullNumber: number;
    commitSha: string;
    summary: string;
  }): Promise<Review> {
    const review = this.reviewRepository.create(data);
    return await this.reviewRepository.save(review);
  }

  async updateReviewStatus(id: string, status: string): Promise<void> {
    await this.reviewRepository.update(id, { status });
  }

  async addReviewComments(reviewId: string, issues: CodeIssue[]): Promise<void> {
    const comments = issues.map(issue =>
      this.commentRepository.create({
        reviewId,
        filePath: 'unknown', // This would need to be parsed from the diff
        lineNumber: issue.line ? parseInt(issue.line) : undefined,
        issueType: issue.type,
        severity: issue.severity,
        message: issue.message,
        suggestion: issue.suggestion,
      })
    );

    await this.commentRepository.save(comments);
  }

  async getReviewByPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<Review | null> {
    return await this.reviewRepository.findOne({
      where: { owner, repo, pullNumber },
      relations: ['comments'],
    });
  }

  async getRecentReviews(limit: number = 10): Promise<Review[]> {
    return await this.reviewRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['comments'],
    });
  }

  async getReviewStats(): Promise<any> {
    const total = await this.reviewRepository.count();
    const completed = await this.reviewRepository.count({
      where: { status: 'completed' },
    });
    const failed = await this.reviewRepository.count({
      where: { status: 'failed' },
    });

    return {
      total,
      completed,
      failed,
      successRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }
}